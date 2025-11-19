#!/bin/bash

# Script para executar o container do Sistema de Alocação de PU

echo "Iniciando Sistema de Alocação de PU..."

docker run -d \
  --name inspecao-final \
  --restart unless-stopped \
  -p 9010:9010 \
  -e DB_HOST=seu_host_postgresql \
  -e DB_USER=seu_usuario \
  -e DB_PSW=sua_senha \
  -e DB_PORT=5432 \
  -e DB_NAME=seu_banco \
  -v $(pwd)/logs:/app/logs \
  inspecao-final:latest

echo "Container iniciado!"
echo "Acesse: http://localhost:9010"
echo ""
echo "Para ver logs: docker logs -f inspecao-final"
echo "Para parar: docker stop inspecao-final"