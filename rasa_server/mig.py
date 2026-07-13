import yaml
import csv
import os
import glob

# --- CONFIGURACIÓN ---
# Puedes poner 'domain.yml' o la ruta a tu carpeta de dominios particionados
DOMAIN_PATH = "domain.yml"
OUTPUT_CSV = "utters.csv"

def extract_utters():
    all_responses = {}

    # Buscamos todos los archivos .yml en la ruta especificada
    files = glob.glob(os.path.join(DOMAIN_PATH, "**/*.yml"), recursive=True)
    if not files and os.path.exists("domain.yml"):
        files = ["domain.yml"]

    print(f"📂 Procesando {len(files)} archivos de dominio...")

    for file_path in files:
        with open(file_path, 'r', encoding='utf-8') as f:
            try:
                data = yaml.safe_load(f)
                if data and 'responses' in data:
                    all_responses.update(data['responses'])
            except Exception as e:
                print(f"❌ Error leyendo {file_path}: {e}")

    # Escribimos el CSV
    # 'utf-8-sig' es el truco para que Excel en Windows reconozca los acentos
    with open(OUTPUT_CSV, 'w', newline='', encoding='utf-8-sig') as csvfile:
        writer = csv.writer(csvfile, delimiter=';')
       
        count = 0
        for utter_name, content in all_responses.items():
            if utter_name.startswith('utter_'):
                # Extraemos el texto de la respuesta
                # Manejamos si es una lista de respuestas (estándar de Rasa)
                text = ""
                if isinstance(content, list) and len(content) > 0:
                    text = content[0].get('text', '')
               
                writer.writerow([utter_name, text])
                count += 1

    print(f"✅ ¡Migración completada! Se han exportado {count} respuestas a {OUTPUT_CSV}")

if __name__ == "__main__":
    extract_utters()
