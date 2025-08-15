// Aguardar o carregamento completo da página
window.addEventListener('load', function() {
    console.log('Página carregada, inicializando aplicação...');

    // Aguardar um pouco mais para garantir que todos os recursos foram carregados
    setTimeout(function() {
        initializeApp();
    }, 100);
});

function initializeApp() {
    // Verificar se o Quill está disponível
    if (typeof Quill === 'undefined') {
        console.error('Quill não foi carregado!');
        alert('Erro: Editor de texto não foi carregado. Tente recarregar a página.');
        return;
    }

    console.log('Quill disponível, configurando editor...');

    // Configurar o editor Quill
    let quill;
    try {
        quill = new Quill('#editor-container', {
            theme: 'snow',
            placeholder: 'Comece a escrever seu relatório...',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    ['blockquote', 'code-block'],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    [{ 'indent': '-1' }, { 'indent': '+1' }],
                    ['link', 'image'],
                    [{ 'color': [] }, { 'background': [] }],
                    ['clean']
                ]
            }
        });
        console.log('Quill inicializado com sucesso');
    } catch (error) {
        console.error('Erro ao inicializar Quill:', error);
        alert('Erro ao inicializar o editor. Tente recarregar a página.');
        return;
    }

    // Elementos DOM
    const folderList = document.getElementById('folder-list');
    const newReportBtn = document.getElementById('new-report-btn');
    const saveBtn = document.getElementById('save-btn');
    const deleteBtn = document.getElementById('delete-btn');
    const reportTitleEl = document.getElementById('report-title');
    const reportDateContainer = document.getElementById('report-date-container');
    const reportDateInput = document.getElementById('report-date');
    const updateDateBtn = document.getElementById('update-date-btn');

    // Verificar se todos os elementos foram encontrados
    if (!folderList || !newReportBtn || !saveBtn || !deleteBtn || !reportTitleEl || 
        !reportDateContainer || !reportDateInput || !updateDateBtn) {
        console.error('Alguns elementos DOM não foram encontrados');
        return;
    }

    console.log('Todos os elementos DOM encontrados');

    // Variáveis globais
    let currentReport = null;
    let expandedState = {};
    let saveInterval = null;
    let reportsData = {}; // Dados dos relatórios

    // Funções utilitárias para datas
    function formatDateForInput(dateStr) {
        // Converte DD/MM/YYYY para YYYY-MM-DD
        if (dateStr && dateStr.includes('/')) {
            const [day, month, year] = dateStr.split('/');
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        return dateStr;
    }

    function formatDateForDisplay(dateStr) {
        // Converte YYYY-MM-DD para DD/MM/YYYY
        if (dateStr && dateStr.includes('-')) {
            const [year, month, day] = dateStr.split('-');
            return `${day}/${month}/${year}`;
        }
        return dateStr;
    }

    function getYearMonthFromDate(dateStr) {
        // Recebe DD/MM/YYYY e retorna {year, month}
        if (dateStr && dateStr.includes('/')) {
            const [day, month, year] = dateStr.split('/');
            return { year: year, month: month };
        }
        return null;
    }
    // Funções para persistência de dados
    function loadReportsFromStorage() {
        try {
            const saved = localStorage.getItem('reports');
            if (saved) {
                reportsData = JSON.parse(saved);
                console.log('Relatórios carregados do localStorage:', Object.keys(reportsData).length, 'anos');
                return true;
            }
        } catch (error) {
            console.warn('Erro ao carregar do localStorage:', error);
        }
        return false;
    }

    function saveReportsToStorage() {
        try {
            localStorage.setItem('reports', JSON.stringify(reportsData));
            console.log('Relatórios salvos no localStorage');
        } catch (error) {
            console.warn('Erro ao salvar no localStorage:', error);
        }
    }

    // Função para habilitar/desabilitar botões
    function updateButtonStates() {
        console.log('Atualizando estado dos botões. currentReport existe:', !!currentReport);
        if (currentReport) {
            saveBtn.disabled = false;
            deleteBtn.disabled = false;
            reportTitleEl.contentEditable = true;
            reportTitleEl.style.cursor = 'text';
            reportDateContainer.style.display = 'block';
        } else {
            saveBtn.disabled = true;
            deleteBtn.disabled = true;
            reportTitleEl.contentEditable = false;
            reportTitleEl.style.cursor = 'default';
            reportDateContainer.style.display = 'none';
        }
    }

    function startAutoSave() {
        if (saveInterval) {
            clearInterval(saveInterval);
        }
        saveInterval = setInterval(() => {
            if (currentReport) {
                const now = new Date().toLocaleTimeString('pt-BR');
                console.log(`🔄 Auto-save executado às ${now} para: ${currentReport.title}`);
                
                const updatedReport = {
                    title: reportTitleEl.textContent.trim() || `Relatório - ${new Date().toLocaleDateString('pt-BR')}`,
                    content: quill.getContents(),
                    lastAutoSave: new Date().toISOString(), // Adicionar timestamp
                    reportDate: currentReport.reportDate,
                    createdDate: currentReport.createdDate
                };
                
                if (reportsData[currentReport.year] && 
                    reportsData[currentReport.year][currentReport.month] && 
                    reportsData[currentReport.year][currentReport.month][currentReport.id]) {
                    
                    reportsData[currentReport.year][currentReport.month][currentReport.id] = updatedReport;
                    currentReport.content = updatedReport.content; // Atualizar referência local
                    saveReportsToStorage();
                    
                    console.log(`✅ Auto-save concluído para: ${currentReport.title}`);
                } else {
                    console.error('❌ Relatório não encontrado na estrutura de dados para auto-save');
                }
            } else {
                console.log('⏸️ Auto-save pausado - nenhum relatório selecionado');
            }
        }, 5000);
        console.log('🕐 Auto-save iniciado (intervalo de 5 segundos)');
    }

    function renderFolders(reports) {
        console.log('Renderizando pastas. Total de anos:', Object.keys(reports).length);
        
        folderList.innerHTML = '';
        const years = Object.keys(reports).sort((a, b) => b - a);

        if (years.length === 0) {
            folderList.innerHTML = '<li class="empty-state">Nenhum relatório encontrado</li>';
            return;
        }

        years.forEach(year => {
            const yearItem = document.createElement('li');
            yearItem.innerHTML = `
                <div class="folder-header">
                    <i class="fas fa-caret-down toggle-icon"></i>
                    <span class="folder-title">${year}</span>
                    <button class="delete-folder-btn" data-type="year" data-key="${year}" title="Excluir ano">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;

            const monthList = document.createElement('ul');
            monthList.classList.add('sub-folder-list');

            const months = Object.keys(reports[year]).sort((a, b) => b - a);
            months.forEach(month => {
                const monthItem = document.createElement('li');
                monthItem.innerHTML = `
                    <div class="folder-header">
                        <i class="fas fa-caret-down toggle-icon"></i>
                        <span class="folder-title">Mês ${month}</span>
                        <button class="delete-folder-btn" data-type="month" data-year="${year}" data-key="${month}" title="Excluir mês">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;

                const reportList = document.createElement('ul');
                reportList.classList.add('sub-folder-list');

                const reportIds = Object.keys(reports[year][month]);
                // Ordenar relatórios por data dentro do mês (mais recentes primeiro)
                reportIds.sort((a, b) => {
                    const reportA = reports[year][month][a];
                    const reportB = reports[year][month][b];
                    const dateA = reportA.reportDate || reportA.createdDate || '';
                    const dateB = reportB.reportDate || reportB.createdDate || '';
                    
                    // Converter DD/MM/YYYY para YYYY-MM-DD para comparação
                    const getComparableDate = (dateStr) => {
                        if (dateStr && dateStr.includes('/')) {
                            const [day, month, year] = dateStr.split('/');
                            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                        }
                        return dateStr;
                    };
                    
                    const compareDateA = getComparableDate(dateA);
                    const compareDateB = getComparableDate(dateB);
                    
                    return compareDateB.localeCompare(compareDateA); // Mais recentes primeiro
                });
                
                reportIds.forEach(reportId => {
                    const report = reports[year][month][reportId];
                    const reportItem = document.createElement('li');
                    reportItem.classList.add('report-item');
                    
                    if (currentReport && 
                        reportId === currentReport.id && 
                        year === currentReport.year && 
                        month === currentReport.month) {
                        reportItem.classList.add('selected');
                    }
                    
                    reportItem.innerHTML = `
                        <i class="far fa-file-alt icon"></i>
                        <span>${report.title}</span>
                    `;
                    reportItem.dataset.id = reportId;
                    reportItem.dataset.year = year;
                    reportItem.dataset.month = month;
                    
                    reportItem.addEventListener('click', (e) => {
                        e.stopPropagation();
                        selectReport(year, month, reportId);
                    });
                    
                    reportList.appendChild(reportItem);
                });

                // Event listener para expandir/contrair mês
                monthItem.querySelector('.folder-header').addEventListener('click', (e) => {
                    if (!e.target.closest('.delete-folder-btn')) {
                        reportList.classList.toggle('hidden');
                        monthItem.querySelector('.toggle-icon').classList.toggle('closed');
                    }
                });

                monthItem.appendChild(reportList);
                monthList.appendChild(monthItem);
            });

            // Event listener para expandir/contrair ano
            yearItem.querySelector('.folder-header').addEventListener('click', (e) => {
                if (!e.target.closest('.delete-folder-btn')) {
                    monthList.classList.toggle('hidden');
                    yearItem.querySelector('.toggle-icon').classList.toggle('closed');
                }
            });

            yearItem.appendChild(monthList);
            folderList.appendChild(yearItem);
        });

        // Event listeners para botões de deletar
        document.querySelectorAll('.delete-folder-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const type = e.currentTarget.dataset.type;
                const key = e.currentTarget.dataset.key;
                const year = e.currentTarget.dataset.year;

                if (confirm(`Tem certeza que deseja apagar esta pasta e todo seu conteúdo?`)) {
                    deleteFolder(type, year, key);
                }
            });
        });

        console.log('Renderização concluída');
    }

    function selectReport(year, month, reportId) {
        console.log('Selecionando relatório:', { year, month, reportId });
        
        if (saveInterval) {
            clearInterval(saveInterval);
        }
        
        // Remover seleção anterior
        document.querySelectorAll('.report-item').forEach(item => {
            item.classList.remove('selected');
        });

        if (!reportsData[year] || 
            !reportsData[year][month] || 
            !reportsData[year][month][reportId]) {
            console.error('Relatório não encontrado:', { year, month, reportId });
            return;
        }

        const reportData = reportsData[year][month][reportId];
        currentReport = {
            title: reportData.title,
            content: reportData.content || [],
            reportDate: reportData.reportDate || reportData.createdDate || '',
            createdDate: reportData.createdDate || '',
            id: reportId,
            year: year,
            month: month
        };

        console.log('Relatório selecionado:', currentReport.title, 'Data:', currentReport.reportDate);

        // Marcar como selecionado na interface
        const reportItem = document.querySelector(`[data-id="${reportId}"][data-year="${year}"][data-month="${month}"]`);
        if (reportItem) {
            reportItem.classList.add('selected');
        }

        // Atualizar interface
        reportTitleEl.textContent = currentReport.title;
        reportDateInput.value = formatDateForInput(currentReport.reportDate);
        
        try {
            quill.setContents(currentReport.content);
            console.log('Conteúdo carregado no editor');
        } catch (error) {
            console.error('Erro ao carregar conteúdo no editor:', error);
            quill.setText(''); // Fallback para texto vazio
        }
        
        // Habilitar botões
        updateButtonStates();
        
        // Iniciar auto-save
        startAutoSave();
        
        console.log(`✅ Relatório "${currentReport.title}" selecionado e carregado`);
    }

    function deleteFolder(type, year, key) {
        console.log('Deletando pasta:', { type, year, key });
        
        if (type === 'year') {
            delete reportsData[key];
        } else if (type === 'month') {
            if (reportsData[year]) {
                delete reportsData[year][key];
                if (Object.keys(reportsData[year]).length === 0) {
                    delete reportsData[year];
                }
            }
        }
        
        // Se o relatório atual foi deletado, limpar interface
        if (currentReport && 
            (currentReport.year === key || 
             (currentReport.year === year && currentReport.month === key))) {
            currentReport = null;
            reportTitleEl.textContent = 'Selecione ou crie um relatório';
            reportDateInput.value = '';
            quill.setContents([]);
            updateButtonStates();
            if (saveInterval) {
                clearInterval(saveInterval);
            }
        }
        
        saveReportsToStorage(); // Salvar alterações
        renderFolders(reportsData);
    }

    // Event listener para "Novo Relatório"
    newReportBtn.addEventListener('click', () => {
        console.log('Botão "Novo Relatório" clicado');
        
        const today = new Date();
        const todayStr = today.toLocaleDateString('pt-BR');
        const year = today.getFullYear().toString();
        const month = (today.getMonth() + 1).toString();
        const newReportId = Date.now().toString();

        console.log('Criando relatório para data:', todayStr, 'em', year, month);

        // Inicializar estrutura se necessário
        if (!reportsData[year]) {
            reportsData[year] = {};
        }
        if (!reportsData[year][month]) {
            reportsData[year][month] = {};
        }

        // Criar novo relatório
        const newReport = {
            title: `Relatório - ${todayStr}`,
            content: [],
            reportDate: todayStr,
            createdDate: todayStr
        };
        
        reportsData[year][month][newReportId] = newReport;
        saveReportsToStorage(); // Salvar no localStorage
        
        console.log('Relatório criado e salvo na estrutura de dados');
        
        // Re-renderizar a lista
        renderFolders(reportsData);
        
        // Selecionar o novo relatório
        selectReport(year, month, newReportId);
        
        console.log('Novo relatório selecionado e interface atualizada');
    });

    // Event listener para "Salvar"
    saveBtn.addEventListener('click', () => {
        console.log('Botão "Salvar" clicado');
        
        if (currentReport) {
            const updatedReport = {
                title: reportTitleEl.textContent.trim() || `Relatório - ${new Date().toLocaleDateString('pt-BR')}`,
                content: quill.getContents(),
                reportDate: currentReport.reportDate,
                createdDate: currentReport.createdDate
            };
            
            reportsData[currentReport.year][currentReport.month][currentReport.id] = updatedReport;
            currentReport.title = updatedReport.title;
            currentReport.content = updatedReport.content;
            
            saveReportsToStorage();
            
            console.log('Relatório salvo:', updatedReport.title);
            alert('Relatório salvo com sucesso!');
            
            renderFolders(reportsData);
        }
    });

    // Event listener para "Excluir"
    deleteBtn.addEventListener('click', () => {
        if (currentReport && confirm('Tem certeza que deseja excluir este relatório?')) {
            console.log('Excluindo relatório:', currentReport.title);
            
            const { year, month, id } = currentReport;
            delete reportsData[year][month][id];
            
            // Limpar pastas vazias
            if (Object.keys(reportsData[year][month]).length === 0) {
                delete reportsData[year][month];
                if (Object.keys(reportsData[year]).length === 0) {
                    delete reportsData[year];
                }
            }

            saveReportsToStorage(); // Salvar no localStorage

            // Limpar interface
            if (saveInterval) {
                clearInterval(saveInterval);
            }
            
            currentReport = null;
            reportTitleEl.textContent = 'Selecione ou crie um relatório';
            quill.setContents([]);
            updateButtonStates();
            
            renderFolders(reportsData);
            console.log('Relatório excluído');
        }
    });

    // Event listener para atualizar data do relatório
    updateDateBtn.addEventListener('click', () => {
        if (!currentReport) return;
        
        const newDate = reportDateInput.value;
        if (!newDate) {
            alert('Por favor, selecione uma data válida.');
            return;
        }
        
        const newDisplayDate = formatDateForDisplay(newDate);
        console.log('Alterando data do relatório de', currentReport.reportDate, 'para', newDisplayDate);
        
        // Atualizar dados do relatório na mesma pasta
        const reportData = reportsData[currentReport.year][currentReport.month][currentReport.id];
        
        // Atualizar a data do relatório
        reportData.reportDate = newDisplayDate;
        
        // Atualizar o título do relatório para incluir a nova data
        const baseTitle = reportData.title.includes(' - ') ? 
            reportData.title.split(' - ')[0] : 
            reportData.title.replace(/Relatório - \d{2}\/\d{2}\/\d{4}/, 'Relatório');
        
        reportData.title = `${baseTitle} - ${newDisplayDate}`;
        
        // Atualizar currentReport
        currentReport.reportDate = newDisplayDate;
        currentReport.title = reportData.title;
        
        // Atualizar interface
        reportTitleEl.textContent = currentReport.title;
        
        saveReportsToStorage();
        renderFolders(reportsData);
        
        // Re-selecionar o relatório (agora reordenado)
        setTimeout(() => {
            selectReport(currentReport.year, currentReport.month, currentReport.id);
        }, 100);
        
        console.log('Data e título atualizados! Novo título:', reportData.title);
        alert(`Data alterada para ${newDisplayDate}. O título e a ordenação foram atualizados automaticamente.`);
    });
    // Event listener para mudanças no título
    reportTitleEl.addEventListener('blur', () => {
        if (currentReport) {
            const newTitle = reportTitleEl.textContent.trim();
            if (newTitle && newTitle !== currentReport.title) {
                console.log('Atualizando título manualmente:', newTitle);
                reportsData[currentReport.year][currentReport.month][currentReport.id].title = newTitle;
                currentReport.title = newTitle;
                saveReportsToStorage();
                renderFolders(reportsData);
            }
        }
    });

    // Prevenir quebra de linha no título
    reportTitleEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            reportTitleEl.blur();
        }
    });

    // Inicializar aplicação
    console.log('Inicializando interface...');
    
    // Tentar carregar dados salvos
    const hasData = loadReportsFromStorage();
    if (hasData) {
        console.log('Dados encontrados, carregando relatórios existentes...');
    } else {
        console.log('Nenhum dado salvo encontrado, iniciando com dados vazios');
    }
    
    updateButtonStates();
    renderFolders(reportsData);
    
    console.log('Aplicação inicializada com sucesso!');
}