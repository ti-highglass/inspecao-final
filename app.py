from flask import Flask, render_template, request, jsonify
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

def get_db_connection():
    return psycopg2.connect(
        host=os.getenv('DB_HOST'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PSW'),
        port=os.getenv('DB_PORT'),
        database=os.getenv('DB_NAME')
    )

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/inspecoes', methods=['GET'])
def get_inspecoes():
    search = request.args.get('search', '')
    tab = request.args.get('tab', 'aprovadas')
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # Definir filtro por aba
    tab_filter = ""
    if tab == 'aprovadas':
        tab_filter = "AND a_peca_foi_aprovada IN ('Sim', 'Não', 'Condicional')"
    elif tab == 'inspecao':
        tab_filter = "AND (a_peca_foi_aprovada IS NULL OR a_peca_foi_aprovada = '')"
    elif tab == 'avaliacao':
        tab_filter = "AND a_peca_foi_aprovada = 'Avaliação'"
    
    base_query = f"""
        SELECT id, data, serial, codigo_de_barras, op, peca, projeto, veiculo, produto, sensor, a_peca_foi_aprovada
        FROM insp_final_checklist 
        WHERE fabrica = 'Graffeno - Jarinu' 
        {tab_filter}
    """
    
    if search:
        query = base_query + " AND (serial ILIKE %s OR op::text ILIKE %s OR codigo_de_barras ILIKE %s OR peca ILIKE %s OR (peca || op::text) ILIKE %s OR projeto ILIKE %s OR veiculo ILIKE %s) ORDER BY data DESC, id DESC LIMIT 100"
        cur.execute(query, (f'%{search}%', f'%{search}%', f'%{search}%', f'%{search}%', f'%{search}%', f'%{search}%', f'%{search}%'))
    else:
        query = base_query + " AND data >= CURRENT_DATE - INTERVAL '1 month' ORDER BY data DESC, id DESC LIMIT 50"
        cur.execute(query)
    
    inspecoes = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify([dict(row) for row in inspecoes])

@app.route('/api/dados-op/<op>', methods=['GET'])
def get_dados_op(op):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT codigo_veiculo, modelo, produto, sensor 
        FROM dados_uso_geral.dados_op 
        WHERE planta = 'Jarinu' AND op = %s
    """, (op,))
    dados = cur.fetchone()
    cur.close()
    conn.close()
    return jsonify(dict(dados) if dados else {})

@app.route('/api/operadores', methods=['GET'])
def get_operadores():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT nome_completo FROM operadores_producao 
        WHERE setor = 'Inspeção Final' AND fabrica = 'Graffeno - Jarinu'
        ORDER BY nome_completo
    """)
    operadores = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify([op['nome_completo'] for op in operadores])

@app.route('/api/tipos-defeitos', methods=['GET'])
def get_tipos_defeitos():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT DISTINCT tipo_defeito FROM dados_uso_geral.tipos_de_defeito 
        WHERE bloco = 'Bloco Blindado' AND status = 'Baixa'
        ORDER BY tipo_defeito
    """)
    tipos = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify([dict(tipo) for tipo in tipos])

@app.route('/api/lideres', methods=['GET'])
def get_lideres():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT nome_completo FROM operadores_producao 
        WHERE operacao_ou_lideranca = 'Líder' AND fabrica = 'Graffeno - Jarinu' and setor = 'Inspeção Final'
        ORDER BY nome_completo
    """)
    lideres = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify([lider['nome_completo'] for lider in lideres])

@app.route('/api/descricoes-defeitos/<tipo_defeito>', methods=['GET'])
def get_descricoes_defeitos(tipo_defeito):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT DISTINCT descricao_defeito FROM dados_uso_geral.tipos_de_defeito 
        WHERE bloco = 'Bloco Blindado' AND status = 'Baixa' AND tipo_defeito = %s
        ORDER BY descricao_defeito
    """, (tipo_defeito,))
    descricoes = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify([desc['descricao_defeito'] for desc in descricoes])

@app.route('/api/inspecoes/<id>', methods=['GET'])
def get_inspecao(id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute('SELECT * FROM insp_final_checklist WHERE id = %s', (id,))
    inspecao = cur.fetchone()
    cur.close()
    conn.close()
    return jsonify(dict(inspecao) if inspecao else {})

@app.route('/api/inspecoes', methods=['POST'])
def create_inspecao():
    data = request.json
    print(f"Dados recebidos: {data}")
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    columns = ', '.join(data.keys())
    placeholders = ', '.join(['%s'] * len(data))
    query = f'INSERT INTO insp_final_checklist ({columns}) VALUES ({placeholders})'
    
    print(f"Query: {query}")
    print(f"Values: {list(data.values())}")
    
    try:
        cur.execute(query, list(data.values()))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        print(f"Erro ao inserir: {str(e)}")
        conn.rollback()
        cur.close()
        conn.close()
        return jsonify({'error': str(e)}), 400

@app.route('/api/inspecoes/<id>', methods=['PUT'])
def update_inspecao(id):
    data = request.json
    
    # Se a_peca_foi_aprovada for Sim, Não ou Condicional, adicionar data_finalizacao
    if data.get('a_peca_foi_aprovada') in ['Sim', 'Não', 'Condicional']:
        data['data_finalizacao'] = 'NOW()'
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    set_clause = ', '.join([f'{k} = %s' for k in data.keys()])
    query = f'UPDATE insp_final_checklist SET {set_clause} WHERE id = %s'
    
    try:
        cur.execute(query, list(data.values()) + [id])
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        return jsonify({'error': str(e)}), 400

@app.route('/api/inspecoes/<id>', methods=['DELETE'])
def delete_inspecao(id):
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute('DELETE FROM insp_final_checklist WHERE id = %s', (id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    print("Sistema de Inspeção Final iniciado!")
    print("Acesse: http://localhost:9000")
    app.run(debug=True, host='0.0.0.0', port=9000)