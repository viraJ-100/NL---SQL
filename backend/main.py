# LANCHAIN WITH RUNABLE

from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from node import schema_text, run_sql
from llm import final_chain

# Load env
load_dotenv()

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QueryRequest(BaseModel):
    question: str

@app.post("/convert")
async def convert_to_sql(request: QueryRequest):
    check = final_chain.invoke({
        "schema": schema_text,
        "question": request.question
    })
    print(check)
    return check

class PageRequest(BaseModel):
    sql: str
    limit: int
    offset: int

# @app.post("/page")
# async def paginate(req: PageRequest):
#     try:
#         paginated_sql = f"{req.sql} LIMIT {req.limit} OFFSET {req.offset}"
#         print(paginated_sql)
#         rows = run_sql(paginated_sql)
#         print(rows)
#         return {
#             "sql": paginated_sql,
#             "page_result": rows,
#             "limit": req.limit,
#             "offset": req.offset
#         }
#     except Exception as e:
#         return {"error": str(e)}