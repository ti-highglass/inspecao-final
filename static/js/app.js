class AppSheetInspecao {
    constructor() {
        this.cardsContainer = document.getElementById('cardsContainer');
        this.modalAdicionar = document.getElementById('modalAdicionar');
        this.modalEditar = document.getElementById('modalEditar');
        this.formAdicionar = document.getElementById('formAdicionar');
        this.formEditar = document.getElementById('formEditar');
        this.statusBar = document.getElementById('status');
        this.editingId = null;
        this.selectedRows = new Set();
        this.searchTimeout = null;
        
        this.initEventListeners();
        this.initTurnoButtons();
        this.initTabs();
        this.currentTab = 'aprovadas';
        this.loadData();
    }

    initEventListeners() {
        // Botões principais
        const btnNovo = document.getElementById('btnNovoFloat');
        if (btnNovo) {
            btnNovo.addEventListener('click', () => {
                console.log('Botão + clicado');
                this.openModalAdicionar();
            });
        }

        
        // Busca automática no campo de pesquisa
        document.getElementById('searchGeral').addEventListener('input', () => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => this.loadData(), 300);
        });

        // Modals
        document.querySelectorAll('.close').forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });
        
        document.querySelectorAll('.btn-cancel').forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });

        // Forms
        this.formAdicionar.addEventListener('submit', (e) => this.handleAdicionarSubmit(e));
        this.formEditar.addEventListener('submit', (e) => this.handleEditarSubmit(e));

        // Código de barras auto-fill
        this.formAdicionar.querySelector('[name="codigo_de_barras"]').addEventListener('input', (e) => {
            this.processCodigoBarras(e.target.value);
        });


        
        // Botões de câmera
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-camera')) {
                this.openCamera(e.target.dataset.field);
            }
        });
    }

    async loadData() {
        const searchField = document.getElementById('searchGeral');
        if (!searchField) {
            console.error('Campo de busca não encontrado');
            return;
        }
        
        const search = searchField.value;
        let url = '/api/inspecoes';
        
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (this.currentTab) params.append('tab', this.currentTab);
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        console.log('Carregando dados da URL:', url);
        this.showStatus('Carregando...', 'info');
        
        try {
            const response = await fetch(url);
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Dados recebidos:', data);
            
            this.renderTable(data);
            const tabName = this.getTabName(this.currentTab);
            const msg = search ? `${data.length} registros encontrados em ${tabName}` : `${data.length} registros em ${tabName}`;
            this.showStatus(msg, 'success');
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            this.showStatus(`Erro ao carregar dados: ${error.message}`, 'error');
        }
    }
    
    getTabName(tab) {
        const names = {
            'aprovadas': 'Aprovadas',
            'inspecao': 'Em Inspeção',
            'avaliacao': 'Aguardando Avaliação'
        };
        return names[tab] || 'Aprovadas';
    }

    renderTable(data) {
        if (!this.cardsContainer) {
            console.error('cardsContainer não encontrado');
            return;
        }
        
        this.cardsContainer.innerHTML = '';
        this.selectedRows.clear();
        
        const fragment = document.createDocumentFragment();
        
        data.forEach(row => {
            console.log('Dados da linha:', row);
            
            // Gerar descrição
            const descricao = row.descricao_carro || this.gerarDescricao(row.peca, row.sensor, row.projeto, row.veiculo, row.produto);
            
            // Determinar status e classe CSS
            const status = row.a_peca_foi_aprovada || 'Em Inspeção';
            let statusClass = 'status-avaliacao';
            if (status === 'Sim') statusClass = 'status-aprovada';
            else if (status === 'Não') statusClass = 'status-reprovada';
            else if (status === 'Condicional') statusClass = 'status-condicional';
            
            const card = document.createElement('div');
            card.className = 'inspection-card';
            card.dataset.id = row.id;
            
            card.innerHTML = `
                <div class="card-header">
                    <h3 class="card-title">${descricao}</h3>
                    <span class="card-status ${statusClass}">${status}</span>
                </div>
                <div class="card-info">
                    <div class="info-item">
                        <span class="info-label">Serial</span>
                        <span class="info-value">${row.serial || '-'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Código Barras</span>
                        <span class="info-value">${row.codigo_de_barras || '-'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">OP</span>
                        <span class="info-value">${row.op || '-'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Data</span>
                        <span class="info-value">${row.data ? this.formatarData(row.data) : '-'}</span>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="card-edit-btn" data-id="${row.id}">✏️ Editar</button>
                </div>
            `;
            
            // Adicionar event listener ao botão de editar
            const btnEdit = card.querySelector('.card-edit-btn');
            btnEdit.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = e.target.getAttribute('data-id');
                console.log('ID do botão clicado:', id);
                this.editRow(id);
            });
            
            fragment.appendChild(card);
        });
        
        this.cardsContainer.appendChild(fragment);
    }



    async openModalAdicionar() {
        console.log('Abrindo modal adicionar');
        this.formAdicionar.reset();
        await this.loadOperadores();
        this.modalAdicionar.style.display = 'block';
        document.body.classList.add('modal-open');
        this.formAdicionar.querySelector('[name="codigo_de_barras"]').focus();
    }

    initTurnoButtons() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-turno')) {
                const field = e.target.dataset.field;
                const turno = e.target.dataset.turno;
                const isActive = e.target.classList.contains('active');
                
                // Remove active de outros botões do mesmo grupo
                e.target.parentElement.querySelectorAll('.btn-turno').forEach(btn => {
                    btn.classList.remove('active');
                });
                
                // Se não estava ativo, ativa. Se estava ativo, desativa (permite deselecionar)
                let selectedValue = '';
                if (!isActive) {
                    e.target.classList.add('active');
                    selectedValue = turno;
                }
                
                // Define valor no campo hidden baseado no campo
                const isAdd = this.modalAdicionar.style.display === 'block';
                let hiddenFieldId = '';
                
                switch(field) {
                    case 'turno_destape':
                        hiddenFieldId = isAdd ? 'turnoDestapeAdd' : 'turnoDestape';
                        break;
                    case 'turno_dimensional':
                        hiddenFieldId = isAdd ? 'turnoDimensionalAdd' : 'turnoDimensional';
                        break;
                    case 'turno_din':
                        hiddenFieldId = isAdd ? 'turnoDinAdd' : 'turnoDin';
                        break;
                    case 'turno_mesa':
                        hiddenFieldId = isAdd ? 'turnoMesaAdd' : 'turnoMesa';
                        break;
                    case 'turno_bloqueio':
                        hiddenFieldId = isAdd ? 'turnoBloqueioAdd' : 'turnoBloqueio';
                        break;
                    case 'aco':
                        hiddenFieldId = isAdd ? 'acoAdd' : 'aco';
                        break;
                    case 'logo':
                        hiddenFieldId = isAdd ? 'logoAdd' : 'logo';
                        break;
                    case 'meio_medicao_curvatura':
                        hiddenFieldId = isAdd ? 'meioMedicaoCurvaturaAdd' : 'meioMedicaoCurvatura';
                        break;
                    case 'intensidade_bloqueio':
                        hiddenFieldId = isAdd ? 'intensidadeBloqueioAdd' : 'intensidadeBloqueio';
                        break;
                    case 'serigrafia_ok':
                        hiddenFieldId = isAdd ? 'serigrafiaOkAdd' : 'serigrafiaOk';
                        break;
                    case 'a_peca_foi_aprovada':
                        hiddenFieldId = isAdd ? 'pecaAprovadaAdd' : 'pecaAprovada';
                        break;
                    case 'dupla_imagem':
                        hiddenFieldId = isAdd ? 'duplaImagemAdd' : 'duplaImagem';
                        break;
                    case 'distorcao':
                        hiddenFieldId = isAdd ? 'distorcaoAdd' : 'distorcao';
                        break;
                }
                
                const hiddenField = document.getElementById(hiddenFieldId);
                if (hiddenField) hiddenField.value = selectedValue;
                
                // Mostrar campos relacionados (passa valor vazio se deselecionado)
                this.toggleRelatedFields(field, selectedValue);
                
                // Mostrar campos condicionais se aprovação for "Condicional"
                if (field === 'a_peca_foi_aprovada') {
                    this.toggleConditionalFields(selectedValue);
                }
            }
        });
    }
    
    toggleRelatedFields(field, turno) {
        const isAdd = this.modalAdicionar.style.display === 'block';
        
        if (field === 'turno_destape') {
            const inspField = document.getElementById(isAdd ? 'inspDestapeAdd' : 'inspDestape');
            if (inspField) inspField.style.display = turno ? 'block' : 'none';
        } else if (field === 'turno_dimensional') {
            const inspField = document.getElementById(isAdd ? 'inspDimensionalAdd' : 'inspDimensional');
            const meioField = document.getElementById(isAdd ? 'meioMedicaoAdd' : 'meioMedicao');
            const perimetrais = document.getElementById(isAdd ? 'camposPerimetraisAdd' : 'camposPerimetrais');
            const curvatura = document.getElementById(isAdd ? 'camposCurvaturaAdd' : 'camposCurvatura');
            
            if (turno) {
                if (inspField) inspField.style.display = 'block';
                if (meioField) meioField.style.display = 'block';
                if (perimetrais) perimetrais.style.display = 'block';
                if (curvatura) curvatura.style.display = 'block';
            } else {
                if (inspField) inspField.style.display = 'none';
                if (meioField) meioField.style.display = 'none';
                if (perimetrais) perimetrais.style.display = 'none';
                if (curvatura) curvatura.style.display = 'none';
            }
        } else if (field === 'turno_din') {
            const detalhesField = document.getElementById(isAdd ? 'camposDinDetalhesAdd' : 'camposDinDetalhes');
            if (detalhesField) detalhesField.style.display = turno ? 'block' : 'none';
        } else if (field === 'turno_mesa') {
            const mesaField = document.getElementById(isAdd ? 'camposMesaAdd' : 'camposMesa');
            if (mesaField) mesaField.style.display = turno ? 'block' : 'none';
        } else if (field === 'turno_bloqueio') {
            const bloqueioField = document.getElementById(isAdd ? 'camposBloqueioAdd' : 'camposBloqueio');
            if (bloqueioField) bloqueioField.style.display = turno ? 'block' : 'none';
        }
    }

    async editRow(id) {
        console.log('Editando ID:', id);
        
        try {
            await this.loadOperadores();
            
            const response = await fetch(`/api/inspecoes/${id}`);
            const data = await response.json();
            
            console.log('Dados recebidos:', data);
            
            this.editingId = id;
            
            // Preencher todos os campos do formulário
            console.log('Preenchendo campos com dados:', data);
            Object.keys(data).forEach(key => {
                const input = this.formEditar.querySelector(`[name="${key}"]`);
                
                if (input && data[key] !== null && data[key] !== undefined && data[key] !== '') {
                    console.log(`Preenchendo ${key} com valor:`, data[key]);
                    
                    if (input.type === 'date') {
                        const date = new Date(data[key]);
                        input.value = date.toISOString().split('T')[0];
                    } else if (input.tagName === 'SELECT') {
                        input.value = String(data[key]);
                        if (input.multiple) {
                            const values = Array.isArray(data[key]) ? data[key] : [data[key]];
                            Array.from(input.options).forEach(option => {
                                option.selected = values.includes(option.value);
                            });
                        }
                    } else {
                        input.value = String(data[key]);
                    }
                    
                    console.log(`Campo ${key} preenchido com:`, input.value);
                }
            });
            
            // Mostrar campo sensor se for PBS
            const sensorField = document.getElementById('sensorField');
            if (data.peca === 'PBS' && sensorField) {
                sensorField.style.display = 'block';
            } else if (sensorField) {
                sensorField.style.display = 'none';
            }
            
            // Gerar descrição se tiver dados
            if (data.peca && data.projeto && data.veiculo && data.produto) {
                const descricao = this.gerarDescricao(data.peca, data.sensor, data.projeto, data.veiculo, data.produto);
                this.formEditar.querySelector('[name="descricao_carro"]').value = descricao;
                
                // Mostrar campo resistência se projeto for 484 ou 485
                const resistenciaField = document.getElementById('resistenciaField');
                if (resistenciaField) {
                    resistenciaField.style.display = (data.projeto === '484' || data.projeto === '485') ? 'block' : 'none';
                }
            }
            
            // Limpar botões ativos antes de ativar novos
            document.querySelectorAll('#modalEditar .btn-turno').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Ativar botões baseados nos valores salvos
            this.activateButtonsFromData(data);
            
            // Mostrar campos relacionados baseados nos dados
            if (data.turno_dimensional) {
                document.getElementById('inspDimensional').style.display = 'block';
                document.getElementById('meioMedicao').style.display = 'block';
                document.getElementById('camposPerimetrais').style.display = 'block';
                document.getElementById('camposCurvatura').style.display = 'block';
            }
            if (data.turno_destape) {
                document.getElementById('inspDestape').style.display = 'block';
            }
            if (data.turno_din) {
                document.getElementById('camposDinDetalhes').style.display = 'block';
            }
            if (data.turno_mesa) {
                document.getElementById('camposMesa').style.display = 'block';
            }
            if (data.turno_bloqueio) {
                document.getElementById('camposBloqueio').style.display = 'block';
            }
            if (data.peca === 'PBS' || data.peca === 'VGA') {
                document.getElementById('camposDin').style.display = 'block';
            }
            
            // Forçar exibição de campos com dados
            const hasPerimetralData = Object.keys(data).some(key => key.startsWith('perimetral_') && data[key]);
            const hasCurvaturaData = Object.keys(data).some(key => key.startsWith('curvatura_') && data[key]);
            const hasOffsetData = Object.keys(data).some(key => key.startsWith('offset_mm_') && data[key]);
            const hasMesaData = data.turno_mesa || data.insp_resp_mesa || data.aco || data.logo || data.espessura_mm;
            
            console.log('Verificando dados:', {
                hasPerimetralData,
                hasCurvaturaData, 
                hasOffsetData,
                hasMesaData,
                offsetKeys: Object.keys(data).filter(k => k.startsWith('offset_mm_'))
            });
            
            if (hasPerimetralData || hasCurvaturaData) {
                document.getElementById('camposPerimetrais').style.display = 'block';
                document.getElementById('camposCurvatura').style.display = 'block';
            }
            
            if (hasMesaData) {
                document.getElementById('camposMesa').style.display = 'block';
            }
            
            this.initDimensionalToggle();
            
            console.log('Abrindo modal...');
            this.modalEditar.style.display = 'block';
            document.body.classList.add('modal-open');
            
            // Forçar preenchimento após modal abrir
            setTimeout(() => {
                console.log('Forçando preenchimento dos campos...');
                
                // Mostrar campos com dados primeiro
                const hasPerimetralData = Object.keys(data).some(key => key.startsWith('perimetral_') && data[key]);
                const hasCurvaturaData = Object.keys(data).some(key => key.startsWith('curvatura_') && data[key]);
                const hasOffsetData = Object.keys(data).some(key => key.startsWith('offset_mm_') && data[key]);
                const hasMesaData = data.turno_mesa || data.insp_resp_mesa || data.aco || data.logo || data.espessura_mm;
                
                if (hasPerimetralData || hasCurvaturaData) {
                    document.getElementById('camposPerimetrais').style.display = 'block';
                    document.getElementById('camposCurvatura').style.display = 'block';
                }
                
                if (hasMesaData) {
                    document.getElementById('camposMesa').style.display = 'block';
                }
                
                // Preencher todos os campos incluindo offsets
                Object.keys(data).forEach(key => {
                    const input = this.formEditar.querySelector(`[name="${key}"]`);
                    if (input && data[key] !== null && data[key] !== undefined && data[key] !== '') {
                        input.value = String(data[key]);
                        if (key.startsWith('offset_mm_')) {
                            console.log(`OFFSET ${key} preenchido:`, input.value);
                        }
                    }
                });
                
                console.log('Campos offset no DOM:', 
                    Array.from(document.querySelectorAll('#modalEditar [name^="offset_mm_"]')).map(el => ({
                        name: el.name,
                        value: el.value,
                        visible: el.offsetParent !== null
                    }))
                );
            }, 300);
            
        } catch (error) {
            console.error('Erro completo:', error);
            this.showStatus('Erro ao carregar dados para edição', 'error');
        }
    }



    closeModals() {
        this.modalAdicionar.style.display = 'none';
        this.modalEditar.style.display = 'none';
        document.body.classList.remove('modal-open');
        this.editingId = null;
    }

    async loadOperadores() {
        try {
            const response = await fetch('/api/operadores');
            const operadores = await response.json();
            
            // Selects do modal editar
            const selectDestape = document.getElementById('selectDestape');
            const selectDimensional = document.getElementById('selectDimensional');
            const selectDin = document.getElementById('selectDin');
            const selectMesa = document.getElementById('selectMesa');
            const selectBloqueio = document.getElementById('selectBloqueio');
            
            // Selects do modal adicionar
            const selectDestapeAdd = document.getElementById('selectDestapeAdd');
            const selectDimensionalAdd = document.getElementById('selectDimensionalAdd');
            const selectDinAdd = document.getElementById('selectDinAdd');
            const selectMesaAdd = document.getElementById('selectMesaAdd');
            const selectBloqueioAdd = document.getElementById('selectBloqueioAdd');
            
            operadores.forEach(nome => {
                // Modal editar
                if (selectDestape) selectDestape.add(new Option(nome, nome));
                if (selectDimensional) selectDimensional.add(new Option(nome, nome));
                if (selectDin) selectDin.add(new Option(nome, nome));
                if (selectMesa) selectMesa.add(new Option(nome, nome));
                if (selectBloqueio) selectBloqueio.add(new Option(nome, nome));
                
                // Modal adicionar
                if (selectDestapeAdd) selectDestapeAdd.add(new Option(nome, nome));
                if (selectDimensionalAdd) selectDimensionalAdd.add(new Option(nome, nome));
                if (selectDinAdd) selectDinAdd.add(new Option(nome, nome));
                if (selectMesaAdd) selectMesaAdd.add(new Option(nome, nome));
                if (selectBloqueioAdd) selectBloqueioAdd.add(new Option(nome, nome));
            });
        } catch (error) {
            console.error('Erro ao carregar operadores:', error);
        }
    }

    initDimensionalToggle() {
        const turnoDimensional = document.getElementById('turnoDimensional');
        const camposPerimetrais = document.getElementById('camposPerimetrais');
        const camposCurvatura = document.getElementById('camposCurvatura');
        
        turnoDimensional.addEventListener('change', (e) => {
            if (e.target.value) {
                camposPerimetrais.style.display = 'block';
                camposCurvatura.style.display = 'block';
            } else {
                camposPerimetrais.style.display = 'none';
                camposCurvatura.style.display = 'none';
            }
        });
    }

    initTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove active de todas as abas
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                // Ativa aba clicada
                e.target.classList.add('active');
                // Define aba atual
                this.currentTab = e.target.dataset.tab;
                // Recarrega dados
                this.loadData();
            });
        });
    }

    gerarDescricao(peca, sensor, projeto, veiculo, produto) {
        if (peca === 'PBS' && sensor) {
            return `${peca} - Sensor ${sensor} - ${projeto} - ${veiculo} - ${produto}`;
        } else {
            return `${peca} - ${projeto} - ${veiculo} - ${produto}`;
        }
    }

    async processCodigoBarras(codigo) {
        if (codigo.length >= 8) {
            const peca = codigo.substring(0, 3);
            const op = codigo.substring(codigo.length - 5);
            
            // Preencher peça e OP nos campos hidden
            this.formAdicionar.querySelector('[name="peca"]').value = peca;
            this.formAdicionar.querySelector('[name="op"]').value = op;
            
            // Buscar dados da OP
            try {
                const response = await fetch(`/api/dados-op/${op}`);
                const dados = await response.json();
                
                if (dados.codigo_veiculo) {
                    const projeto = dados.codigo_veiculo;
                    const veiculo = dados.modelo || '';
                    const produto = dados.produto || '';
                    const sensor = dados.sensor || '';
                    
                    this.formAdicionar.querySelector('[name="projeto"]').value = projeto;
                    this.formAdicionar.querySelector('[name="veiculo"]').value = veiculo;
                    this.formAdicionar.querySelector('[name="produto"]').value = produto;
                    
                    // Mostrar campo sensor apenas para PBS
                    const sensorField = document.getElementById('sensorFieldAdd');
                    if (peca === 'PBS') {
                        this.formAdicionar.querySelector('[name="sensor"]').value = sensor || '';
                        sensorField.style.display = 'block';
                    } else {
                        this.formAdicionar.querySelector('[name="sensor"]').value = '';
                        sensorField.style.display = 'none';
                    }
                    
                    // Mostrar campos DIN apenas para PBS ou VGA
                    const camposDin = document.getElementById('camposDinAdd');
                    if (peca === 'PBS' || peca === 'VGA') {
                        if (camposDin) camposDin.style.display = 'block';
                    } else {
                        if (camposDin) camposDin.style.display = 'none';
                    }
                    
                    // Resetar botões de câmera
                    this.resetCameraButtons();
                    
                    console.log('Dados da OP:', dados);
                    console.log('Sensor recebido:', sensor);
                    console.log('Peça:', peca);
                    
                    // Gerar descrição
                    const descricao = this.gerarDescricao(peca, sensor, projeto, veiculo, produto);
                    this.formAdicionar.querySelector('[name="descricao_carro"]').value = descricao;
                    
                    // Mostrar campo resistência se projeto for 484 ou 485
                    const resistenciaField = document.getElementById('resistenciaFieldAdd');
                    if (resistenciaField) {
                        resistenciaField.style.display = (projeto === '484' || projeto === '485') ? 'block' : 'none';
                    }
                }
            } catch (error) {
                console.error('Erro ao buscar dados da OP:', error);
            }
        }
    }

    async handleAdicionarSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(this.formAdicionar);
        const data = Object.fromEntries(formData.entries());
        
        // Adicionar data/hora atual do Brasil e fábrica
        const now = new Date();
        const brasiliaTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
        data.data = brasiliaTime.toISOString();
        data.fabrica = 'Graffeno - Jarinu';
        
        // Adicionar data_finalizacao se aprovada
        if (data.a_peca_foi_aprovada && ['Sim', 'Não', 'Condicional'].includes(data.a_peca_foi_aprovada)) {
            data.data_finalizacao = brasiliaTime.toISOString();
        }
        
        console.log('Dados do formulário:', data);
        console.log('Peça:', data.peca);
        console.log('OP:', data.op);
        
        try {
            const response = await fetch('/api/inspecoes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.closeModals();
                this.loadData();
                this.showStatus('Inspeção adicionada com sucesso!', 'success');
            } else {
                console.error('Erro do servidor:', result.error);
                this.showStatus('Erro: ' + (result.error || 'Erro desconhecido'), 'error');
            }
        } catch (error) {
            console.error('Erro na requisição:', error);
            this.showStatus('Erro ao salvar inspeção', 'error');
        }
    }

    async handleEditarSubmit(e) {
        e.preventDefault();
        
        console.log('Iniciando edição, ID:', this.editingId);
        
        if (!this.editingId) {
            console.error('ID de edição não definido');
            this.showStatus('Erro: ID de edição não encontrado', 'error');
            return;
        }
        
        const formData = new FormData(this.formEditar);
        const data = Object.fromEntries(formData.entries());
        
        console.log('Dados do formulário de edição:', data);
        
        try {
            const url = `/api/inspecoes/${this.editingId}`;
            console.log('URL de edição:', url);
            
            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            console.log('Response status:', response.status);
            
            const result = await response.json();
            console.log('Resultado da edição:', result);
            
            if (result.success) {
                this.closeModals();
                this.loadData();
                this.showSuccessPopup('Inspeção atualizada com sucesso!');
            } else {
                console.error('Erro do servidor:', result.error);
                this.showStatus('Erro: ' + (result.error || 'Erro desconhecido'), 'error');
            }
        } catch (error) {
            console.error('Erro na requisição de edição:', error);
            this.showStatus('Erro ao atualizar inspeção: ' + error.message, 'error');
        }
    }

    async deleteRow(id) {
        if (!confirm('Tem certeza que deseja excluir esta inspeção?')) return;
        
        try {
            const response = await fetch(`/api/inspecoes/${id}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.loadData();
                this.showStatus('Inspeção excluída com sucesso!', 'success');
            } else {
                this.showStatus('Erro ao excluir: ' + (result.error || 'Erro desconhecido'), 'error');
            }
        } catch (error) {
            this.showStatus('Erro ao excluir inspeção', 'error');
        }
    }

    formatarData(dataString) {
        if (!dataString) return '';
        
        const data = new Date(dataString);
        const dia = data.getDate().toString().padStart(2, '0');
        const mes = (data.getMonth() + 1).toString().padStart(2, '0');
        const ano = data.getFullYear();
        const horas = data.getHours().toString().padStart(2, '0');
        const minutos = data.getMinutes().toString().padStart(2, '0');
        
        return `${dia}/${mes}/${ano} ${horas}:${minutos}`;
    }

    showStatus(message, type = 'info') {
        this.statusBar.textContent = message;
        this.statusBar.className = `status-bar show ${type}`;
        
        setTimeout(() => {
            this.statusBar.classList.remove('show');
        }, 4000);
    }
    
    showSuccessPopup(message) {
        const popup = document.createElement('div');
        popup.className = 'success-popup';
        popup.textContent = message;
        popup.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4caf50;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 10000;
            font-weight: 500;
            animation: slideInRight 0.3s ease;
        `;
        
        document.body.appendChild(popup);
        
        setTimeout(() => {
            popup.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(popup);
            }, 300);
        }, 3000);
    }
    
    async openCamera(fieldName) {
        // Fallback para input file em dispositivos móveis
        if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            this.openFileInput(fieldName);
            return;
        }
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                } 
            });
            
            // Criar modal de câmera
            const cameraModal = document.createElement('div');
            cameraModal.className = 'modal';
            cameraModal.style.display = 'block';
            cameraModal.innerHTML = `
                <div class="modal-content" style="max-width: 800px;">
                    <div class="modal-header">
                        <h2>📷 Capturar Foto - ${fieldName}</h2>
                        <span class="close" id="closeCameraModal">&times;</span>
                    </div>
                    <div style="padding: 20px; text-align: center;">
                        <video id="cameraVideo" autoplay playsinline style="width: 100%; max-width: 600px; border-radius: 8px;"></video>
                        <canvas id="cameraCanvas" style="display: none;"></canvas>
                        <div style="margin-top: 20px;">
                            <button id="captureBtn" class="btn btn-primary">📷 Capturar</button>
                            <button id="cancelCameraBtn" class="btn btn-cancel">Cancelar</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(cameraModal);
            
            const video = document.getElementById('cameraVideo');
            const canvas = document.getElementById('cameraCanvas');
            const captureBtn = document.getElementById('captureBtn');
            const cancelBtn = document.getElementById('cancelCameraBtn');
            const closeBtn = document.getElementById('closeCameraModal');
            
            video.srcObject = stream;
            
            const closeCamera = () => {
                stream.getTracks().forEach(track => track.stop());
                document.body.removeChild(cameraModal);
            };
            
            captureBtn.addEventListener('click', () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0);
                
                const base64 = canvas.toDataURL('image/jpeg', 0.8);
                
                // Salvar no campo hidden
                const isAdd = this.modalAdicionar.style.display === 'block';
                const form = isAdd ? this.formAdicionar : this.formEditar;
                const hiddenField = form.querySelector(`[name="${fieldName}"]`);
                if (hiddenField) {
                    hiddenField.value = base64;
                }
                
                // Atualizar botão e mostrar preview
                const cameraBtn = form.querySelector(`[data-field="${fieldName}"]`);
                const preview = document.getElementById(`preview_${fieldName}`);
                if (cameraBtn) {
                    cameraBtn.innerHTML = '✓ Foto Capturada';
                    cameraBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
                }
                if (preview) {
                    preview.src = base64;
                    preview.style.display = 'block';
                }
                
                this.showStatus('Foto capturada com sucesso!', 'success');
                closeCamera();
            });
            
            cancelBtn.addEventListener('click', closeCamera);
            closeBtn.addEventListener('click', closeCamera);
            
        } catch (error) {
            console.error('Erro ao acessar câmera:', error);
            this.openFileInput(fieldName);
        }
    }
    
    openFileInput(fieldName) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64 = event.target.result;
                    
                    // Salvar no campo hidden
                    const isAdd = this.modalAdicionar.style.display === 'block';
                    const form = isAdd ? this.formAdicionar : this.formEditar;
                    const hiddenField = form.querySelector(`[name="${fieldName}"]`);
                    if (hiddenField) {
                        hiddenField.value = base64;
                    }
                    
                    // Atualizar botão e mostrar preview
                    const cameraBtn = form.querySelector(`[data-field="${fieldName}"]`);
                    const preview = document.getElementById(`preview_${fieldName}`);
                    if (cameraBtn) {
                        cameraBtn.innerHTML = '✓ Foto Capturada';
                        cameraBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
                    }
                    if (preview) {
                        preview.src = base64;
                        preview.style.display = 'block';
                    }
                    
                    this.showStatus('Foto capturada com sucesso!', 'success');
                };
                reader.readAsDataURL(file);
            }
        });
        
        input.click();
    }
    
    resetCameraButtons() {
        const cameraButtons = document.querySelectorAll('.btn-camera');
        cameraButtons.forEach(btn => {
            btn.innerHTML = '📷 Tirar Foto';
            btn.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
        });
    }
    
    toggleConditionalFields(aprovacao) {
        const isAdd = this.modalAdicionar.style.display === 'block';
        const camposCondicionais = document.getElementById(isAdd ? 'camposCondicionaisAdd' : 'camposCondicionais');
        
        if (camposCondicionais) {
            camposCondicionais.style.display = aprovacao === 'Condicional' ? 'block' : 'none';
            
            if (aprovacao === 'Condicional') {
                this.loadTiposDefeitos(isAdd);
                this.loadLideres(isAdd);
                this.initSignaturePad(isAdd);
            }
        }
    }
    
    async loadTiposDefeitos(isAdd) {
        try {
            const response = await fetch('/api/tipos-defeitos');
            const tipos = await response.json();
            
            const select = document.getElementById(isAdd ? 'razaoCondicionalAdd' : 'razaoCondicional');
            if (select) {
                select.innerHTML = '<option value="">Selecione</option>';
                tipos.forEach(tipo => {
                    select.add(new Option(tipo.tipo_defeito, tipo.tipo_defeito));
                });
                
                // Adicionar event listener para carregar descrições
                select.addEventListener('change', (e) => {
                    this.loadDescricoesDefeitos(e.target.value, isAdd);
                });
            }
        } catch (error) {
            console.error('Erro ao carregar tipos de defeitos:', error);
        }
    }
    
    async loadDescricoesDefeitos(tipoDefeito, isAdd) {
        const descSelect = document.getElementById(isAdd ? 'descricaoRazaoCondicionalAdd' : 'descricaoRazaoCondicional');
        if (!descSelect) return;
        
        descSelect.innerHTML = '<option value="">Selecione</option>';
        
        if (!tipoDefeito) return;
        
        try {
            const response = await fetch(`/api/descricoes-defeitos/${encodeURIComponent(tipoDefeito)}`);
            const descricoes = await response.json();
            
            descricoes.forEach(desc => {
                descSelect.add(new Option(desc, desc));
            });
        } catch (error) {
            console.error('Erro ao carregar descrições de defeitos:', error);
        }
    }
    
    async loadLideres(isAdd) {
        try {
            const response = await fetch('/api/lideres');
            const lideres = await response.json();
            
            const select = document.getElementById(isAdd ? 'liberacaoLiderAdd' : 'liberacaoLider');
            if (select) {
                select.innerHTML = '<option value="">Selecione</option>';
                lideres.forEach(lider => {
                    select.add(new Option(lider, lider));
                });
            }
        } catch (error) {
            console.error('Erro ao carregar líderes:', error);
        }
    }
    
    activateButtonsFromData(data) {
        console.log('Ativando botões com dados:', data);
        
        const buttonFields = [
            'turno_destape', 'turno_dimensional', 'turno_din', 'turno_mesa', 'turno_bloqueio',
            'aco', 'logo', 'intensidade_bloqueio', 'serigrafia_ok', 'a_peca_foi_aprovada',
            'dupla_imagem', 'distorcao'
        ];
        
        buttonFields.forEach(field => {
            if (data[field]) {
                console.log(`Ativando campo ${field} com valor:`, data[field]);
                
                // Encontrar botões com o campo correspondente no modal de edição
                const buttons = document.querySelectorAll(`#modalEditar [data-field="${field}"]`);
                console.log(`Botões encontrados para ${field}:`, buttons.length);
                
                buttons.forEach(btn => {
                    console.log(`Verificando botão:`, btn.dataset.turno, 'vs', data[field]);
                    if (btn.dataset.turno === data[field]) {
                        btn.classList.add('active');
                        console.log(`Botão ${field} ativado:`, btn.dataset.turno);
                        
                        // Definir valor no campo hidden
                        const hiddenField = document.getElementById(this.getHiddenFieldId(field, false));
                        if (hiddenField) {
                            hiddenField.value = data[field];
                            console.log(`Campo hidden ${field} definido:`, hiddenField.value);
                        }
                        
                        // Mostrar campos relacionados
                        this.toggleRelatedFields(field, data[field]);
                    }
                });
            }
        });
        
        // Mostrar campos condicionais se aprovado como "Condicional"
        if (data.a_peca_foi_aprovada === 'Condicional') {
            this.toggleConditionalFields('Condicional');
        }
    }
    
    getHiddenFieldId(field, isAdd) {
        const fieldMap = {
            'turno_destape': isAdd ? 'turnoDestapeAdd' : 'turnoDestape',
            'turno_dimensional': isAdd ? 'turnoDimensionalAdd' : 'turnoDimensional',
            'turno_din': isAdd ? 'turnoDinAdd' : 'turnoDin',
            'turno_mesa': isAdd ? 'turnoMesaAdd' : 'turnoMesa',
            'turno_bloqueio': isAdd ? 'turnoBloqueioAdd' : 'turnoBloqueio',
            'aco': isAdd ? 'acoAdd' : 'aco',
            'logo': isAdd ? 'logoAdd' : 'logo',
            'intensidade_bloqueio': isAdd ? 'intensidadeBloqueioAdd' : 'intensidadeBloqueio',
            'serigrafia_ok': isAdd ? 'serigrafiaOkAdd' : 'serigrafiaOk',
            'a_peca_foi_aprovada': isAdd ? 'pecaAprovadaAdd' : 'pecaAprovada',
            'dupla_imagem': isAdd ? 'duplaImagemAdd' : 'duplaImagem',
            'distorcao': isAdd ? 'distorcaoAdd' : 'distorcao'
        };
        return fieldMap[field] || '';
    }
    
    initSignaturePad(isAdd) {
        const canvas = document.getElementById(isAdd ? 'assinaturaCanvasAdd' : 'assinaturaCanvas');
        const clearBtn = document.getElementById(isAdd ? 'limparAssinaturaAdd' : 'limparAssinatura');
        const hiddenField = document.getElementById(isAdd ? 'assinaturaLiderAdd' : 'assinaturaLider');
        
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        
        let isDrawing = false;
        let lastX = 0;
        let lastY = 0;
        
        const getEventPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            
            if (e.touches && e.touches[0]) {
                return {
                    x: (e.touches[0].clientX - rect.left) * scaleX,
                    y: (e.touches[0].clientY - rect.top) * scaleY
                };
            }
            return {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY
            };
        };
        
        const startDrawing = (e) => {
            e.preventDefault();
            isDrawing = true;
            const pos = getEventPos(e);
            lastX = pos.x;
            lastY = pos.y;
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
        };
        
        const draw = (e) => {
            e.preventDefault();
            if (!isDrawing) return;
            
            const pos = getEventPos(e);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            lastX = pos.x;
            lastY = pos.y;
        };
        
        const stopDrawing = (e) => {
            e.preventDefault();
            if (!isDrawing) return;
            isDrawing = false;
            hiddenField.value = canvas.toDataURL();
        };
        
        // Mouse events
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);
        
        // Touch events para dispositivos móveis
        canvas.addEventListener('touchstart', startDrawing);
        canvas.addEventListener('touchmove', draw);
        canvas.addEventListener('touchend', stopDrawing);
        canvas.addEventListener('touchcancel', stopDrawing);
        
        clearBtn.addEventListener('click', () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            hiddenField.value = '';
        });
    }
}

const app = new AppSheetInspecao();
