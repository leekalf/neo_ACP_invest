from fastapi import FastAPI
from database import engine, Base

app = FastAPI(
    title="ACP National Investment System",
    version="1.0.0"
)

Base.metadata.create_all(bind=engine)

@app.get("/")
def root():
    return {"message": "ACP Investment System Running"}