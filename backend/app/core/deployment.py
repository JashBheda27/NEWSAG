from urllib.parse import urlparse
from typing import Final, Literal


DEPLOYMENT_MODE_LOCAL: Final[str] = "local"
DEPLOYMENT_MODE_CLOUD: Final[str] = "cloud"
DEPLOYMENT_MODE_UNKNOWN: Final[str] = "unknown"

DEPLOYMENT_MODES: Final[tuple[str, str, str]] = (
    DEPLOYMENT_MODE_LOCAL,
    DEPLOYMENT_MODE_CLOUD,
    DEPLOYMENT_MODE_UNKNOWN,
)

DeploymentMode = Literal["local", "cloud", "unknown"]


def is_valid_deployment_mode(value: str) -> bool:
    return value in DEPLOYMENT_MODES


def infer_deployment_mode(base_url: str) -> DeploymentMode:
    """Infer whether an LLM endpoint appears local/private or cloud/public."""
    try:
        host = (urlparse(base_url).hostname or "").lower()
    except Exception:
        host = ""

    if not host:
        return DEPLOYMENT_MODE_UNKNOWN

    if host in {"localhost", "127.0.0.1", "::1"}:
        return DEPLOYMENT_MODE_LOCAL

    if host.startswith("10.") or host.startswith("192.168."):
        return DEPLOYMENT_MODE_LOCAL

    if host.startswith("172."):
        parts = host.split(".")
        if len(parts) > 1:
            try:
                second = int(parts[1])
                if 16 <= second <= 31:
                    return DEPLOYMENT_MODE_LOCAL
            except ValueError:
                pass

    if host.endswith(".local"):
        return DEPLOYMENT_MODE_LOCAL

    return DEPLOYMENT_MODE_CLOUD