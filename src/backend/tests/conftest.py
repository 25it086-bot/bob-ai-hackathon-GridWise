import sys
from pathlib import Path

# Ensure the backend app is importable from tests
sys.path.insert(0, str(Path(__file__).parent.parent))
