from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.evaluation import router as evaluation_router
from routers.report import router as report_router

app = FastAPI(
    title="FinSight API",
    description="AI financial intelligence evaluation platform.",
    version="2.1.0",
)

# Allow the local frontend dev server to call the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(evaluation_router)
app.include_router(report_router)

@app.get("/")
def read_root():
    return {"status": "FinSight API is running"}
