import os
from pathlib import Path
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv

# Load .env from the same directory as this file
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

api_key = os.environ.get("OPENAI_API_KEY")

# Fallback: Try to manually read .env if load_dotenv failed or key is missing
if not api_key or api_key == "mock-key":
    print(f"DEBUG: OPENAI_API_KEY missing. Checking .env at {env_path}")
    if env_path.exists():
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip().startswith("OPENAI_API_KEY="):
                        # Naive parsing
                        parts = line.strip().split("=", 1)
                        if len(parts) == 2:
                            api_key = parts[1].strip().strip('"').strip("'")
                            os.environ["OPENAI_API_KEY"] = api_key
                            print("DEBUG: Manually loaded OPENAI_API_KEY from .env")
                            break
        except Exception as e:
            print(f"DEBUG: Error reading .env manually: {e}")

if not api_key:
    print("WARNING: OPENAI_API_KEY is still not set. Using 'mock-key'.")
    api_key = "mock-key"

# Using gpt-4o as a fallback if gpt-5.1 is not available or valid
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o")
OPENAI_TEMP = 0.3

conversation_llm = ChatOpenAI(
    model=OPENAI_MODEL,
    temperature=OPENAI_TEMP,
    api_key=api_key,
)
