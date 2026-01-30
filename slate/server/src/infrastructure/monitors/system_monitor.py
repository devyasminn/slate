"""System resource monitoring using psutil and pynvml."""
import psutil
from dataclasses import dataclass

try:
    import pynvml
    PYNVML_AVAILABLE = True
except ImportError:
    PYNVML_AVAILABLE = False


@dataclass
class SystemStats:
    """Current system resource usage."""
    cpu_percent: float
    ram_percent: float
    gpu_percent: float | None


class SystemMonitor:
    """Monitors system resources (CPU, RAM, GPU)."""
    
    def __init__(self) -> None:
        # Initialize CPU measurement (first call returns 0)
        psutil.cpu_percent(interval=None)
        
        # Initialize NVIDIA GPU monitoring
        self._gpu_available = False
        self._gpu_handle = None
        if PYNVML_AVAILABLE:
            try:
                pynvml.nvmlInit()
                count = pynvml.nvmlDeviceGetCount()
                if count > 0:
                    self._gpu_handle = pynvml.nvmlDeviceGetHandleByIndex(0)
                    self._gpu_available = True
                    print(f"GPU Monitor initialized. Found {count} devices.")
                else:
                    print("GPU Monitor: No devices found.")
            except pynvml.NVMLError as e:
                print(f"GPU Monitor initialization failed: {e}")

    
    def get_stats(self) -> SystemStats:
        """Get current system statistics."""
        gpu_percent = None
        if self._gpu_available and self._gpu_handle:
            try:
                utilization = pynvml.nvmlDeviceGetUtilizationRates(self._gpu_handle)
                gpu_percent = float(utilization.gpu)
            except pynvml.NVMLError:
                pass
        
        return SystemStats(
            cpu_percent=round(psutil.cpu_percent(interval=None), 1),
            ram_percent=round(psutil.virtual_memory().percent, 1),
            gpu_percent=gpu_percent,
        )
