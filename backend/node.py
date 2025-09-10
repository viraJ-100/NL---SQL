from sqlalchemy import create_engine, inspect, text
from statsmodels.tsa.arima.model import ARIMA
import pandas as pd
import os
import json,re

db_path = os.path.abspath("../northwind.db")
engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
inspector = inspect(engine)

# Build schema text
schema_text = ""
with engine.connect() as conn:
    for table_name in inspector.get_table_names():
        columns = inspector.get_columns(table_name)
        col_str = ", ".join([c["name"] for c in columns])

        # Fetch first row as sample
        sample_row = conn.execute(text(f'SELECT * FROM "{table_name}" LIMIT 1')).fetchone()
        sample_data = {}
        if sample_row:
            for col, val in zip([c["name"] for c in columns], sample_row):
                if isinstance(val, (bytes, memoryview)):
                    continue
                try:
                    json.dumps(val)  # ensure serializable
                    sample_data[col] = val
                except:
                    sample_data[col] = str(val)

        schema_text += f"Table: {table_name} (columns: {col_str}) Sample: {sample_data}\n"

def validate_sql(query: str) -> bool:
    unsafe_keywords = [
        "DROP", "DELETE", "UPDATE", "INSERT",
        "ALTER", "CREATE", "TRUNCATE", "REPLACE"
    ]
    q_upper = query.upper()
    return not any(kw in q_upper for kw in unsafe_keywords)

def run_sql(sql_query: str):
    if not validate_sql(sql_query):
        return {"error": "❌ Unsafe SQL detected. Only SELECT queries are allowed."}
    
    try:
        with engine.connect() as conn:
            result = conn.execute(text(sql_query))
            rows = result.fetchall()
            columns = result.keys()

        if rows:
            # Convert rows to list of dicts safely
            clean_data = []
            for row in rows:
                row_dict = {}
                for col, val in zip(columns, row):
                    # Skip invalid datatypes (BLOB, bytes, memoryview, etc.)
                    if isinstance(val, (bytes, memoryview)):
                        continue
                    try:
                        json.dumps(val)  # test if serializable
                        row_dict[col] = val
                    except (TypeError, UnicodeDecodeError):
                        continue
                clean_data.append(row_dict)

            return pd.DataFrame(clean_data).to_dict(orient="records")
        else:
            return []
    except Exception as e:
        return {"error": str(e)}

# def one_run_sql(sql_query: str):
#     try:
#         # Always enforce pagination (limit 10, offset 0)
#         paginated_query = f"""
#             SELECT * FROM (
#                 {sql_query}
#             ) AS subquery
#             LIMIT 10 OFFSET 0
#         """

#         with engine.connect() as conn:
#             result = conn.execute(text(paginated_query))
#             rows = result.fetchall()
#             columns = result.keys()

#         if rows:
#             # Convert rows to list of dicts safely
#             clean_data = []
#             for row in rows:
#                 row_dict = {}
#                 for col, val in zip(columns, row):
#                     # Skip invalid datatypes (BLOB, bytes, memoryview, etc.)
#                     if isinstance(val, (bytes, memoryview)):
#                         continue
#                     try:
#                         json.dumps(val)  # test if serializable
#                         row_dict[col] = val
#                     except (TypeError, UnicodeDecodeError):
#                         continue
#                 clean_data.append(row_dict)

#             return pd.DataFrame(clean_data).to_dict(orient="records")
#         else:
#             return []
#     except Exception as e:
#         return {"error": str(e)}


def parse_and_run(output: str):
    cleaned_response = re.sub(r"^```json|```$", "", output.strip(), flags=re.MULTILINE).strip()

    try:
        parsed = json.loads(cleaned_response)
    except Exception as e:
        return {"error": f"Failed to parse JSON: {str(e)}", "raw": output}
    
    sql = parsed["sql"]
    result = run_sql(sql)

    return {
        "intent": parsed.get("intent"),
        "sql": sql,
        "original_sql": sql, 
        "page_result": result,
        "chart": parsed.get("chart", "Bar"),  # default fallback
        "result": result
    }



def run_forecast_if_needed(data: dict):
    # If intent is General → return as-is
    if data.get("intent") != "Forecast":
        return data

    result = data.get("result", [])
    if not result or len(result) < 5:
        data["forecast_error"] = "Not enough historical data to forecast"
        return data

    # Convert result to DataFrame
    df = pd.DataFrame(result)

    # Detect date column (first column that can be parsed as datetime)
    date_col = None
    for col in df.columns:
        try:
            parsed = pd.to_datetime(df[col], errors='coerce')
            if parsed.notna().sum() > len(df) * 0.5:  # at least 50% valid dates
                date_col = col
                df[col] = parsed
                break
        except Exception:
            continue

    if not date_col:
        data["forecast_error"] = "No valid date column found"
        return data

    # Detect numeric value column (first numeric column other than date)
    value_col = None
    for col in df.columns:
        if col != date_col and pd.api.types.is_numeric_dtype(df[col]):
            value_col = col
            break

    if not value_col:
        data["forecast_error"] = "No numeric column found for forecasting"
        return data

    # Clean data
    df = df.dropna(subset=[date_col])
    df.sort_values(date_col, inplace=True)

    # Fit ARIMA model
    ts = df.set_index(date_col)[value_col]
    try:
        model = ARIMA(ts, order=(1, 1, 1))
        model_fit = model.fit()
        forecast_steps = 3  # Default horizon
        forecast = model_fit.forecast(steps=forecast_steps)

        # Prepare forecast results
        forecast_dates = pd.date_range(start=df[date_col].iloc[-1] + pd.offsets.MonthEnd(),
                                       periods=forecast_steps, freq='M')
        forecast_data = [
            {date_col: str(d.date()), value_col: float(v), "type": "forecast"}
            for d, v in zip(forecast_dates, forecast)
        ]

        # Keep last 2 historical + all forecast
        last_two = df.iloc[-2:][[date_col, value_col]].copy()
        last_two["type"] = "historical"
        last_two_records = last_two.to_dict(orient="records")

        data["result"] = last_two_records + forecast_data
    except Exception as e:
        data["forecast_error"] = str(e)

    return data
