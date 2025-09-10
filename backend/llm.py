# LANCHAIN WITH RUNABLE
from dotenv import load_dotenv
from langchain_google_genai import GoogleGenerativeAI
from langchain.prompts import PromptTemplate
from langchain_core.runnables import RunnableLambda
from node import parse_and_run, run_forecast_if_needed
import os

# Load env
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

# LLM setup
llm = GoogleGenerativeAI(model="gemini-2.0-flash", google_api_key=api_key)

# Updated template
template = """
You are an expert SQL + Data Visualization assistant.

Your tasks:
1. If the query refers to any latest time related query use the latest time from the table. 
   - if the query requests a specific time use that time.  
   Example: if Orders table has dates only until 2023-10-28, treat that as "now".

2. Classify the query intent into one of two categories:
   - General → retrieving current/past data
   - Forecast → asking to predict or project future data

3. Generate a **single valid SQL query** that corresponds to the user's question.
   - Use only the provided schema.
   - Do not add explanations or comments.
   - If the question is about Forecast, generate the SQL needed to retrieve the historical data that would be used as input for forecasting.

4. Decide the best **chart type** to visualize the SQL result.  
   - If the user explicitly asks for a chart type, use that.  
   - Otherwise, choose the most suitable from: `KPI`, `Line`, `Bar`, `Pie`, `Histogram`.  
     (Examples: proportions → Pie, time series → Line, ranking/comparison → Bar, distribution → Histogram, single-number highlight → KPI)

Database schema:
{schema}

Format the output strictly as JSON:
{{
  "intent": "<General or Forecast>",
  "sql": "<SQL query>",
  "chart": "<KPI | Line | Bar | Pie | Histogram>"
}}

Question: {question}
"""

# Prompt
combined_template = PromptTemplate(
    input_variables=["schema", "question"],
    template=template
)

# Wrap in RunnableLambda
parse_and_run_chain = RunnableLambda(parse_and_run)
forecast_chain = RunnableLambda(run_forecast_if_needed)

# Build the final chain
final_chain = combined_template | llm | parse_and_run_chain | forecast_chain