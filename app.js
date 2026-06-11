const URL_API = "https://script.google.com/macros/s/AKfycbz8nFm1oqgzqwWI-TmdZmV1b1Gaw3Ekotxaygk6EmT8hI0c340MWYOvrhLJzsjSNnSo/exec";
let dadosGlobais = [];
let currentCategory = 'novos';
let currentMode = 'vista';
let currentResult = {};
let comparedModel = null;

const formatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 2
});

async function carregarDados() {
    try {
        const res = await fetch(URL_API);
        dadosGlobais = await res.json();
        loadModels();
    } catch (err) {
        console.error("Erro ao carregar BD:", err);
    }
}

function login() {
    if(document.getElementById('pass').value === "clientesMKS") {
        document.getElementById('login-screen').style.display = 'none';
        const app = document.getElementById('app');
        app.classList.remove('hidden');
        setTimeout(() => app.classList.add('opacity-100'), 50);
        carregarDados();
    } else {
        document.getElementById('pass').classList.add('error-shake');
        document.getElementById('err-msg').style.opacity = '1';
        setTimeout(() => {
            document.getElementById('pass').classList.remove('error-shake');
            document.getElementById('err-msg').style.opacity = '0';
        }, 1000);
    }
}

function setCategory(cat) {
    currentCategory = cat;
    document.getElementById('btn-novos').classList.toggle('tab-active', cat === 'novos');
    document.getElementById('btn-seminovos').classList.toggle('tab-active', cat === 'seminovos');
    loadModels();
}

function setPaymentMode(mode) {
    currentMode = mode;
    
    // Atualiza os rótulos do input de busca conforme o modo ativo (Visão Comercial)
    const label = document.getElementById('budget-label');
    const input = document.getElementById('budget-input');
    
    if(mode === 'vista') {
        label.innerText = "Quanto o cliente quer investir no total? (Opcional)";
        input.placeholder = "Ex: 5000";
    } else {
        label.innerText = "Quanto o cliente tem de entrada? (Opcional)";
        input.placeholder = "Ex: 2000";
    }

    document.getElementById('btn-vista').classList.toggle('tab-active', mode === 'vista');
    document.getElementById('btn-parc').classList.toggle('tab-active', mode === 'parc');
    document.getElementById('vista-display').classList.toggle('hidden', mode === 'parc');
    document.getElementById('parc-section').classList.toggle('hidden', mode === 'vista');
    
    loadModels(); // Recarrega aplicando o contexto correto do filtro
}

function getEntry(modelName, price) {
    const name = modelName.toLowerCase();
    const isSeminovo = currentCategory === 'seminovos';
    if (name.includes("16 pro max")) return isSeminovo ? 3500 : 4500;
    if (name.includes("16 pro")) return isSeminovo ? 3000 : 4000;
    if (name.includes("16")) return isSeminovo ? 1800 : 2000;
    if (price > 6000) return price * 0.5;
    if (name.includes('15')) return 1500;
    if (name.includes('14')) return 1300;
    return 1000;
}

function loadModels() {
    const select = document.getElementById('model-select');
    const budgetInput = document.getElementById('budget-input');
    const valorDigitado = budgetInput.value ? parseFloat(budgetInput.value) : null;
    
    select.innerHTML = '';
    
    let filtrados = dadosGlobais.filter(item => {
        const tipo = (item.tipo || "").toString().trim().toLowerCase();
        return tipo === currentCategory;
    });

    // Filtro Inteligente Adaptativo (À vista busca preço total, parcelado busca entrada)
    if (valorDigitado !== null && !isNaN(valorDigitado)) {
        filtrados = filtrados.filter(item => {
            let precoLimpo = item.preco.toString().replace(/[^\d,.-]/g, '').replace(',', '.');
            const preco = parseFloat(precoLimpo);
            
            if (currentMode === 'vista') {
                return preco <= valorDigitado;
            } else {
                const nomeCompleto = `${item.modelo} - ${item.capacidade}`;
                const entradaRequerida = getEntry(nomeCompleto, preco);
                return entradaRequerida <= valorDigitado;
            }
        });
    }

    if (filtrados.length === 0) {
        let opt = document.createElement('option');
        opt.value = "";
        opt.text = "Nenhum modelo compatível localizado";
        select.add(opt);
    } else {
        filtrados.forEach(item => {
            let opt = document.createElement('option');
            let precoLimpo = item.preco.toString().replace(/[^\d,.-]/g, '').replace(',', '.');
            opt.value = parseFloat(precoLimpo);
            opt.text = `${item.modelo} - ${item.capacidade}`;
            select.add(opt);
        });
    }
    calculate();
}

function startComparison() {
    const select = document.getElementById('model-select');
    if(!select.value) return;

    comparedModel = {
        modelo: select.options[select.selectedIndex].text,
        modo: currentMode,
        total: currentResult.totalFinal || currentResult.total,
        parcelas: currentResult.parcelas || 1,
        valorParcela: currentResult.valorParcela || currentResult.total
    };
    document.getElementById('comp-text').innerText = comparedModel.modelo + " (" + (comparedModel.modo === 'vista' ? 'À Vista' : comparedModel.parcelas + 'x') + ")";
    document.getElementById('comp-info').classList.remove('hidden');
    select.classList.add('comparison-active');
    calculate();
}

function clearComparison() {
    comparedModel = null;
    document.getElementById('comp-info').classList.add('hidden');
    document.getElementById('model-select').classList.remove('comparison-active');
    calculate();
}

function calculate() {
    const select = document.getElementById('model-select');
    if(!select.value) {
        document.getElementById('final-cash-price').innerText = formatter.format(0);
        document.getElementById('entry-price').innerText = formatter.format(0);
        document.getElementById('remainder-price').innerText = formatter.format(0);
        document.getElementById('parcela-val').innerText = formatter.format(0);
        document.getElementById('total-val').innerText = formatter.format(0);
        return;
    }

    const precoOriginal = parseFloat(select.value);
    const modelName = select.options[select.selectedIndex].text;
    
    currentResult = { modelo: modelName, categoria: currentCategory.toUpperCase() };

    if(currentMode === 'vista') {
        document.getElementById('final-cash-price').innerText = formatter.format(precoOriginal);
        currentResult.total = precoOriginal;
        currentResult.modo = "À VISTA (PIX)";
        
        // Mantém a exibição da economia teórica em relação ao parcelamento padrão
        document.getElementById('economy-section').classList.remove('hidden');
        const lucroPadraoFicticio = 600; 
        const economy = lucroPadraoFicticio;
        document.getElementById('economy-value').innerText = formatter.format(economy);
        setTimeout(() => document.getElementById('saving-fill').style.width = "100%", 50);
    } else {
        const entrada = getEntry(modelName, precoOriginal);
        const parcelas = parseInt(document.getElementById('installments').value);
        const saldo = precoOriginal - entrada;
        
        // Lucro fixo escalonado da MKS mantido intocado
        let lucro = (parcelas <= 3) ? 300 : (parcelas <= 6) ? 600 : 1000;
        
        // MATEMÁTICA PURA DO PIX MENSAL: Saldo + Lucro sem taxas de máquina
        const totalFinanciado = saldo + lucro;
        const valorParcela = totalFinanciado / parcelas;

        document.getElementById('qty-label').innerText = parcelas + 'x';
        document.getElementById('entry-price').innerText = formatter.format(entrada);
        document.getElementById('remainder-price').innerText = formatter.format(saldo);
        document.getElementById('parcela-val').innerText = formatter.format(valorParcela);
        document.getElementById('total-val').innerText = formatter.format(totalFinanciado + entrada);

        currentResult.totalFinal = totalFinanciado + entrada;
        currentResult.valorParcela = valorParcela;
        currentResult.entrada = entrada;
        currentResult.parcelas = parcelas;
        currentResult.modo = "PIX MENSAL";
    }

    if (comparedModel) {
        const diffTotal = (currentResult.totalFinal || currentResult.total) - comparedModel.total;
        const diffParc = (currentResult.valorParcela || currentResult.total) - comparedModel.valorParcela;
        
        updateVisualDiff('diff-total-val', diffTotal, "total");
        updateVisualDiff('diff-parc-val', diffParc, "mensal");
    }
}

function updateVisualDiff(id, diff, type) {
    const el = document.getElementById(id);
    const isZero = Math.abs(diff) < 0.1;
    const isNegative = diff < 0;

    if (isZero) {
        el.innerHTML = `<span class="text-gray-500 text-[10px]">Sem alteração</span>`;
    } else {
        const badgeClass = isNegative ? 'diff-down' : 'diff-up';
        const prefix = isNegative ? '' : '+';
        
        let subText = type === "mensal" ? 
            (isNegative ? "Menos por mês" : "A mais por mês") : 
            (isNegative ? "Economia Total" : "Acréscimo no Total");

        el.innerHTML = `
            <div class="diff-badge ${badgeClass}">${prefix}${formatter.format(Math.abs(diff))}</div>
            <span class="block text-[7px] text-gray-500 mt-1 uppercase font-bold tracking-tight">${subText}</span>
        `;
    }
}

function sendWhatsApp() {
    if(!currentResult.modelo) return;

    // Calcula a data sugerida para a primeira parcela (daqui a 30 dias)
    const hoje = new Date();
    hoje.setDate(hoje.getDate() + 30);
    const dataPrimeiraParcela = hoje.toLocaleDateString('pt-BR');

    let msg = `*MKS TECH SOLUTIONS - PROPOSTA COMERCIAL*%0A%0A`;
    msg += `Fala, meu irmão! Segue a simulação exclusiva que combinamos para o seu novo iPhone:%0A%0A`;
    msg += `📱 *Aparelho:* ${currentResult.modelo}%0A`;
    msg += `✨ *Condição:* ${currentResult.categoria}%0A`;
    msg += `💳 *Forma de Pagamento:* ${currentResult.modo}%0A%0A`;

    if (currentMode === 'vista') {
        msg += `💰 *Preço Especial PIX à Vista:* ${formatter.format(currentResult.total)}%0A%0A`;
        msg += `🚀 _Aparelho liberado imediatamente após confirmação._%0A`;
    } else {
        msg += `📥 *Entrada:* ${formatter.format(currentResult.entrada)} %0A`;
        msg += `🗓️ *Parcelamento:* ${currentResult.parcelas}x de ${formatter.format(currentResult.valorParcela)} fixas no PIX%0A`;
        msg += `📅 _Sugestão para o 1º pagamento mensal: ${dataPrimeiraParcela}_%0A%0A`;
        msg += `🔒 *Valor total do contrato:* ${formatter.format(currentResult.totalFinal)}%0A`;
    }
    
    msg += `%0A⚠️ _Atenção: Esta simulação é válida apenas para o estoque atual devido à alta rotatividade. Vamos garantir o seu?_`;
    
    window.open(`https://wa.me/555132884938?text=${msg}`, '_blank');
}