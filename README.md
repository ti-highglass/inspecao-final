# Sistema de Inspeção Final

Sistema web para controle e registro de inspeções finais de produtos.

## Funcionalidades

- Registro de inspeções com múltiplos turnos
- Captura de fotos via câmera
- Controle de qualidade com campos específicos
- Interface responsiva e intuitiva

## Tecnologias

- Python Flask
- HTML/CSS/JavaScript
- SQLite (banco de dados)

## Instalação

1. Clone o repositório:
```bash
git clone https://github.com/ti-highglass/inspecao-final.git
cd inspecao-final
```

2. Instale as dependências:
```bash
pip install -r requirements.txt
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

4. Execute a aplicação:
```bash
python app.py
```

## Uso

Acesse `http://localhost:5000` no seu navegador para usar o sistema.

## Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request
