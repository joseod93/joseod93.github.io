# =============================================================
# Copiar y pegar en Google Colab (Runtime > Change runtime > GPU)
# https://colab.research.google.com
# =============================================================

# 1. Instalar dependencias
!pip install ultralytics roboflow

# 2. Descargar dataset
from roboflow import Roboflow
rf = Roboflow(api_key="4yM3LMWEhYquAg0apnEG")
project = rf.workspace("augmented-startups").project("playing-cards-ow27d")
dataset = project.version(4).download("yolov8")

# 3. Verificar GPU
import torch
print(f"CUDA: {torch.cuda.is_available()}")
print(f"GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'NONE'}")

# 4. Entrenar (GPU = ~15-20 min en T4)
from ultralytics import YOLO
model = YOLO("yolov8n.pt")
results = model.train(
    data="Playing-Cards-4/data.yaml",
    epochs=50,
    imgsz=640,
    batch=32,
    device=0,
    workers=2,
    patience=10,
)

# 5. Validar
metrics = model.val()
print(f"mAP50: {metrics.box.map50:.3f}")
print(f"mAP50-95: {metrics.box.map:.3f}")

# 6. Exportar a ONNX
model.export(format="onnx", imgsz=640, simplify=True)

# 7. Guardar en Google Drive
from google.colab import drive
drive.mount('/content/drive')

import shutil
shutil.copy('runs/detect/train/weights/best.onnx', '/content/drive/MyDrive/best.onnx')
print("Modelo guardado en Drive: MyDrive/best.onnx")
