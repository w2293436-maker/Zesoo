"""应用配置文件"""

import os

# DeepSeek API 配置
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")

# 尝试从 .env 文件加载（本地开发用）
try:
    from dotenv import load_dotenv
    _env_path = os.path.join(os.path.dirname(__file__), ".env")
    load_dotenv(_env_path)
    DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", DEEPSEEK_API_KEY)
except ImportError:
    pass
DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"
DEEPSEEK_MODEL = "deepseek-chat"

# 文件配置
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
MAX_FILE_SIZE_MB = 50
ALLOWED_EXTENSIONS = {".pdf", ".txt", ".docx"}

# 文本分段配置
MAX_CHUNK_TOKENS = 6000  # 每段最大 token 数（给汇总留空间）
CHUNK_OVERLAP_TOKENS = 200  # 段间重叠 token 数

# 确保上传目录存在
os.makedirs(UPLOAD_DIR, exist_ok=True)
