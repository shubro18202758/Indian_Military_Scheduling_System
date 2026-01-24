"""
GPU Acceleration Configuration
===============================

Centralizes GPU configuration for all AI and computational services.
Supports NVIDIA CUDA for accelerated matrix operations, pathfinding, and AI inference.
"""

import os
import logging
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass
from enum import Enum

# Set environment variables for GPU optimization BEFORE importing numpy/torch
os.environ.setdefault('CUDA_VISIBLE_DEVICES', '0')
os.environ.setdefault('TF_FORCE_GPU_ALLOW_GROWTH', 'true')
os.environ.setdefault('PYTORCH_CUDA_ALLOC_CONF', 'max_split_size_mb:512')

import numpy as np

# Try to import CuPy for GPU-accelerated NumPy operations
try:
    import cupy as cp
    CUPY_AVAILABLE = True
except ImportError:
    cp = None
    CUPY_AVAILABLE = False

# Try to import PyTorch for GPU tensors
try:
    import torch
    TORCH_AVAILABLE = True
    CUDA_AVAILABLE = torch.cuda.is_available()
except ImportError:
    torch = None
    TORCH_AVAILABLE = False
    CUDA_AVAILABLE = False


class ComputeDevice(Enum):
    CPU = "cpu"
    CUDA = "cuda"
    CUPY = "cupy"


@dataclass
class GPUInfo:
    """GPU hardware information"""
    name: str
    memory_total_mb: int
    memory_used_mb: int
    memory_free_mb: int
    compute_capability: Tuple[int, int]
    is_available: bool


class GPUAccelerator:
    """
    GPU Acceleration Manager
    
    Provides unified interface for GPU-accelerated computations across:
    - Matrix operations (pathfinding, optimization)
    - Distance calculations (Haversine, routing)
    - AI model inference (Ollama integration)
    - Genetic algorithms (population-based optimization)
    """
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self.logger = logging.getLogger(__name__)
        self.device = ComputeDevice.CPU
        self.gpu_info: Optional[GPUInfo] = None
        self.use_gpu = False
        
        # Initialize GPU
        self._detect_and_configure_gpu()
        self._initialized = True
    
    def _detect_and_configure_gpu(self):
        """Detect available GPU and configure for optimal performance."""
        
        # Check CUDA via PyTorch
        if TORCH_AVAILABLE and CUDA_AVAILABLE:
            try:
                device_id = 0
                gpu_name = torch.cuda.get_device_name(device_id)
                mem_total = torch.cuda.get_device_properties(device_id).total_memory // (1024 * 1024)
                mem_reserved = torch.cuda.memory_reserved(device_id) // (1024 * 1024)
                mem_allocated = torch.cuda.memory_allocated(device_id) // (1024 * 1024)
                
                # Get compute capability
                major, minor = torch.cuda.get_device_capability(device_id)
                
                self.gpu_info = GPUInfo(
                    name=gpu_name,
                    memory_total_mb=mem_total,
                    memory_used_mb=mem_allocated,
                    memory_free_mb=mem_total - mem_reserved,
                    compute_capability=(major, minor),
                    is_available=True
                )
                
                self.device = ComputeDevice.CUDA
                self.use_gpu = True
                
                # Set default tensor type to CUDA
                torch.set_default_tensor_type('torch.cuda.FloatTensor')
                
                self.logger.info(f"GPU Enabled: {gpu_name} ({mem_total}MB VRAM)")
                self.logger.info(f"Compute Capability: {major}.{minor}")
                
            except Exception as e:
                self.logger.warning(f"CUDA detection failed: {e}")
                self.device = ComputeDevice.CPU
        
        # Fallback to CuPy if available
        elif CUPY_AVAILABLE:
            try:
                cp.cuda.Device(0).use()
                mem_info = cp.cuda.Device(0).mem_info
                
                self.gpu_info = GPUInfo(
                    name="CUDA Device (CuPy)",
                    memory_total_mb=mem_info[1] // (1024 * 1024),
                    memory_used_mb=(mem_info[1] - mem_info[0]) // (1024 * 1024),
                    memory_free_mb=mem_info[0] // (1024 * 1024),
                    compute_capability=(0, 0),
                    is_available=True
                )
                
                self.device = ComputeDevice.CUPY
                self.use_gpu = True
                
                self.logger.info("GPU Enabled via CuPy")
                
            except Exception as e:
                self.logger.warning(f"CuPy GPU detection failed: {e}")
                self.device = ComputeDevice.CPU
        
        else:
            self.logger.info("No GPU detected, using CPU")
            self.device = ComputeDevice.CPU
    
    def get_array_module(self):
        """Get the appropriate array module (numpy or cupy)."""
        if self.device == ComputeDevice.CUPY and CUPY_AVAILABLE:
            return cp
        return np
    
    def to_gpu(self, array: np.ndarray) -> Any:
        """Transfer numpy array to GPU."""
        if self.device == ComputeDevice.CUPY and CUPY_AVAILABLE:
            return cp.asarray(array)
        elif self.device == ComputeDevice.CUDA and TORCH_AVAILABLE:
            return torch.from_numpy(array).cuda()
        return array
    
    def to_cpu(self, array: Any) -> np.ndarray:
        """Transfer GPU array back to CPU."""
        if CUPY_AVAILABLE and isinstance(array, cp.ndarray):
            return cp.asnumpy(array)
        elif TORCH_AVAILABLE and isinstance(array, torch.Tensor):
            return array.cpu().numpy()
        return array
    
    def gpu_haversine_batch(self, coords1: np.ndarray, coords2: np.ndarray) -> np.ndarray:
        """
        GPU-accelerated batch Haversine distance calculation.
        
        Args:
            coords1: Array of (lat, lon) pairs, shape (N, 2)
            coords2: Array of (lat, lon) pairs, shape (M, 2)
        
        Returns:
            Distance matrix of shape (N, M) in kilometers
        """
        xp = self.get_array_module()
        R = 6371.0  # Earth radius in km
        
        # Convert to GPU arrays
        c1 = self.to_gpu(coords1) if isinstance(coords1, np.ndarray) else coords1
        c2 = self.to_gpu(coords2) if isinstance(coords2, np.ndarray) else coords2
        
        # Convert to radians
        lat1 = xp.radians(c1[:, 0:1])
        lon1 = xp.radians(c1[:, 1:2])
        lat2 = xp.radians(c2[:, 0:1]).T
        lon2 = xp.radians(c2[:, 1:2]).T
        
        # Haversine formula (vectorized)
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = xp.sin(dlat / 2) ** 2 + xp.cos(lat1) * xp.cos(lat2) * xp.sin(dlon / 2) ** 2
        c = 2 * xp.arctan2(xp.sqrt(a), xp.sqrt(1 - a))
        
        distances = R * c
        
        return self.to_cpu(distances)
    
    def gpu_matrix_multiply(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        """GPU-accelerated matrix multiplication."""
        xp = self.get_array_module()
        
        a_gpu = self.to_gpu(a)
        b_gpu = self.to_gpu(b)
        
        result = xp.matmul(a_gpu, b_gpu)
        
        return self.to_cpu(result)
    
    def gpu_dijkstra_preparation(self, adjacency_matrix: np.ndarray) -> Dict[str, Any]:
        """
        Prepare adjacency matrix on GPU for accelerated graph operations.
        """
        xp = self.get_array_module()
        
        adj_gpu = self.to_gpu(adjacency_matrix.astype(np.float32))
        
        # Precompute sparse representation if beneficial
        return {
            "adjacency": adj_gpu,
            "n_nodes": adjacency_matrix.shape[0],
            "device": self.device.value
        }
    
    def gpu_genetic_crossover(self, population: np.ndarray, 
                              crossover_rate: float = 0.8) -> np.ndarray:
        """
        GPU-accelerated genetic algorithm crossover operation.
        """
        xp = self.get_array_module()
        
        pop_gpu = self.to_gpu(population)
        n_individuals, n_genes = pop_gpu.shape
        
        # Generate crossover masks
        masks = xp.random.random((n_individuals // 2, n_genes)) < crossover_rate
        
        # Perform crossover
        parents1 = pop_gpu[::2]
        parents2 = pop_gpu[1::2]
        
        offspring1 = xp.where(masks, parents1, parents2)
        offspring2 = xp.where(masks, parents2, parents1)
        
        new_population = xp.empty_like(pop_gpu)
        new_population[::2] = offspring1
        new_population[1::2] = offspring2
        
        return self.to_cpu(new_population)
    
    def gpu_mutation(self, population: np.ndarray, 
                     mutation_rate: float = 0.01,
                     mutation_strength: float = 0.1) -> np.ndarray:
        """
        GPU-accelerated mutation operation.
        """
        xp = self.get_array_module()
        
        pop_gpu = self.to_gpu(population)
        
        # Generate mutation masks and values
        mask = xp.random.random(pop_gpu.shape) < mutation_rate
        mutations = xp.random.normal(0, mutation_strength, pop_gpu.shape)
        
        # Apply mutations
        mutated = pop_gpu + (mask * mutations)
        
        return self.to_cpu(mutated)
    
    def gpu_fitness_evaluation(self, population: np.ndarray, 
                               weights: np.ndarray) -> np.ndarray:
        """
        GPU-accelerated fitness evaluation for route optimization.
        """
        xp = self.get_array_module()
        
        pop_gpu = self.to_gpu(population)
        weights_gpu = self.to_gpu(weights)
        
        # Weighted sum fitness (customize as needed)
        fitness = xp.sum(pop_gpu * weights_gpu, axis=1)
        
        return self.to_cpu(fitness)
    
    def get_status(self) -> Dict[str, Any]:
        """Get current GPU status and configuration."""
        status = {
            "gpu_enabled": self.use_gpu,
            "device": self.device.value,
            "cupy_available": CUPY_AVAILABLE,
            "torch_available": TORCH_AVAILABLE,
            "cuda_available": CUDA_AVAILABLE
        }
        
        if self.gpu_info:
            status.update({
                "gpu_name": self.gpu_info.name,
                "vram_total_mb": self.gpu_info.memory_total_mb,
                "vram_free_mb": self.gpu_info.memory_free_mb,
                "compute_capability": f"{self.gpu_info.compute_capability[0]}.{self.gpu_info.compute_capability[1]}"
            })
        
        return status


# Global GPU accelerator instance
gpu_accelerator = GPUAccelerator()


def get_gpu_accelerator() -> GPUAccelerator:
    """Get the global GPU accelerator instance."""
    return gpu_accelerator
