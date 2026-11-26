/**
 * Formulário da pesquisa — Projeto Integrador (URI Santo Ângelo).
 *
 * As telas foram desenhadas no Figma
 * (https://www.figma.com/design/tzlNKR1mxe1fqrAkR4axKg) e, em cada comparação,
 * são telas do MESMO aplicativo — muda só aquilo que a pergunta quer medir.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ ANTES DE RODAR — LIBERAR AS PERMISSÕES                                  │
 * │                                                                         │
 * │ O erro "You do not have permission to call DriveApp/UrlFetchApp"        │
 * │ acontece porque o projeto foi autorizado antes de o script usar imagem. │
 * │ Para resolver:                                                          │
 * │                                                                         │
 * │ 1. No editor, clique na engrenagem (Configurações do projeto).          │
 * │ 2. Marque "Mostrar arquivo de manifesto appsscript.json no editor".     │
 * │ 3. Volte ao editor e abra o arquivo appsscript.json, na lista à         │
 * │    esquerda. Apague o conteúdo e cole isto:                             │
 * │                                                                         │
 * │ {                                                                       │
 * │   "timeZone": "America/Sao_Paulo",                                      │
 * │   "dependencies": {},                                                   │
 * │   "exceptionLogging": "STACKDRIVER",                                    │
 * │   "runtimeVersion": "V8",                                               │
 * │   "oauthScopes": [                                                      │
 * │     "https://www.googleapis.com/auth/forms",                            │
 * │     "https://www.googleapis.com/auth/drive.readonly",                   │
 * │     "https://www.googleapis.com/auth/script.external_request"           │
 * │   ]                                                                     │
 * │ }                                                                       │
 * │                                                                         │
 * │ 4. Salve. Ao executar, o Google vai pedir autorização DE NOVO —         │
 * │    aceite ("Avançado" > "Acessar projeto" > "Permitir").                │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * DUAS FUNÇÕES — escolha qual executar na barra do editor:
 *
 *   adicionarImagens()  → coloca as imagens no formulário que JÁ EXISTE
 *                         (o id está em FORM_ID). É esta que você quer agora.
 *   criarFormulario()   → cria um formulário novo, do zero, com tudo.
 */

/** O formulário já criado, onde as imagens vão entrar. */
const FORM_ID = '1WteB05UQ6Zaa-ARr-ze9F-e7gwFF5_MUtr_JuNftu50';

const IMAGENS = {
  entender: '11L564UmRJy63NC2Iv8lF99XYDZu_0yWq', // 1-entender.png
  tema: '17oClHMoXe5ze6cPSiV4ZH2DiLqFhUddK', // 2-tema.png
  evolucao: '1Do-38XXOeZIqD_UOJkCNRJ5m47DGKdok', // 3-evolucao.png
  densidade: '16Wks8UrAJMbUbocxJNIP1gLqLrPTCDEP', // 4-densidade.png
  estilos: '', // 5-estilos.png — subir no Drive e colar o id aqui
};

function criarFormulario() {
  const form = FormApp.create('Como você usa seu celular e acompanha sua rotina');

  form.setDescription(
    'Pesquisa da disciplina de Projeto Integrador (URI Santo Ângelo) para entender ' +
      'preferências de uso e de interface.\n\n' +
      'São 2 minutos e as respostas são anônimas. Não existe resposta certa nem errada — ' +
      'responda do seu jeito, mesmo que você quase não use aplicativos.',
  );

  form.setProgressBar(false);
  form.setCollectEmail(false);
  form.setAllowResponseEdits(true);
  form.setShowLinkToRespondAgain(false);
  form.setConfirmationMessage('Pronto, obrigado! Suas respostas ajudam muito o nosso trabalho.');

  escolha(form, 'Como você costuma acompanhar sua atividade física?', [
    'Anoto no celular',
    'Anoto no papel',
    'Uso algum aplicativo',
    'Guardo de cabeça',
    'Não acompanho',
  ]);

  escolha(
    form,
    'Quando precisa lembrar de um número da vez anterior (peso, tempo, quantidade), onde ele está?',
    ['Bloco de notas do celular', 'Papel', 'Aplicativo específico', 'Planilha', 'Só na memória'],
  );

  imagem(form, IMAGENS.entender, 'Cinco telas iniciais do mesmo aplicativo');
  escolha(form, 'Olhando as telas acima, em qual delas você entende mais rápido o que fazer?', [
    'A — um botão grande em destaque',
    'B — uma lista com títulos curtos',
    'C — uma grade de ícones',
    'D — números grandes',
    'E — um texto explicando',
  ]);

  // --- com imagem: a mesma tela, no escuro e no claro ---
  imagem(form, IMAGENS.tema, 'A mesma tela do aplicativo, clara e escura');
  escolha(form, 'Qual das duas é mais confortável para você?', [
    'A — clara',
    'B — escura',
    'Depende da hora do dia',
    'Tanto faz',
  ]);

  // --- com imagem: três formas de ver o histórico, no mesmo aplicativo ---
  imagem(form, IMAGENS.evolucao, 'Quatro telas do mesmo aplicativo, mostrando o histórico de jeitos diferentes');
  escolha(form, 'Qual delas te mostra melhor se você está evoluindo?', [
    'A — um número só, a média',
    'B — gráfico dos últimos dias',
    'C — calendário com os dias marcados',
    'D — lista dia a dia',
    'Não gosto de acompanhar',
  ]);

  // --- com imagem: o mesmo conteúdo em quatro estilos visuais ---
  imagem(form, IMAGENS.estilos, 'O mesmo conteúdo, em quatro estilos visuais');
  escolha(form, 'Qual desses estilos mais te agrada?', [
    'A — minimalista, preto e branco',
    'B — claro, com cartões e ícones coloridos',
    'C — escuro, com gráficos e muita informação',
    'D — arredondado e colorido, estilo jogo',
  ]);

  // --- com imagem: pouca ou muita informação na mesma tela ---
  imagem(form, IMAGENS.densidade, 'Duas telas: uma com pouca informação, outra com muita');
  escolha(form, 'Numa tela, você prefere', [
    'A — poucos itens, com números grandes',
    'B — mais informação de uma vez, em letra menor',
  ]);

  escolha(form, 'Quando um aplicativo confirma que deu certo, o que te deixa seguro?', [
    'Uma vibração curta',
    'Um som',
    'A tela mudar',
    'Uma mensagem escrita',
    'Não preciso de confirmação',
  ]);

  escolha(form, 'Sobre vibração nos aplicativos', [
    'Gosto, ajuda a confirmar',
    'Tanto faz',
    'Me incomoda, costumo desligar',
    'Nunca reparei',
  ]);

  escolha(form, 'Sobre som nos aplicativos', ['Mantenho ligado', 'Só vibração', 'Deixo tudo mudo']);

  escolha(form, 'O que faz você continuar usando um aplicativo por mais de um mês?', [
    'Ser rápido de usar',
    'Funcionar sem internet',
    'Me lembrar das coisas',
    'Mostrar meu progresso',
    'Ser bonito',
    'Normalmente eu largo',
  ]);

  escolha(form, 'Com que frequência você faz atividade física?', [
    'Todo dia',
    '3 a 5 vezes por semana',
    '1 ou 2 vezes por semana',
    'De vez em quando',
    'Não faço',
  ]);

  caixas(form, 'Já teve dificuldade de usar o celular durante uma atividade física por causa de', [
    'Mãos suadas ou ocupadas',
    'Letra pequena',
    'Internet ruim',
    'Muitos toques até achar o que queria',
    'Tela difícil de ver',
    'Nunca tive',
  ]);

  caixas(form, 'O que mais te irrita em um aplicativo?', [
    'Muitos passos para algo simples',
    'Propaganda',
    'Obrigar a criar conta',
    'Lentidão',
    'Letra pequena',
    'Não funcionar sem internet',
    'Notificação demais',
  ]);

  caixas(form, 'Você usa alguma dessas opções no seu celular?', [
    'Modo escuro',
    'Fonte maior',
    'Reduzir animações',
    'Nenhuma',
  ]);

  Logger.log('Link para editar:    ' + form.getEditUrl());
  Logger.log('Link para responder: ' + form.getPublishedUrl());
}

/** Pergunta de uma resposta só. */
function escolha(form, titulo, opcoes) {
  form.addMultipleChoiceItem().setTitle(titulo).setChoiceValues(opcoes);
}

/** Pergunta de marcar várias, com o campo "Outro" ligado. */
function caixas(form, titulo, opcoes) {
  form.addCheckboxItem().setTitle(titulo).setChoiceValues(opcoes).showOtherOption(true);
}

/**
 * A imagem das alternativas, logo acima da pergunta. Sem id, é pulada.
 *
 * Busca o arquivo pelo link público do Drive (UrlFetchApp) e, se isso falhar,
 * tenta pelo DriveApp. O caminho público existe porque o DriveApp às vezes
 * esbarra em permissão/escopo mesmo com o arquivo compartilhado.
 */
function imagem(form, fileId, titulo) {
  if (!fileId) {
    Logger.log('SEM IMAGEM — id não preenchido: ' + titulo);
    return;
  }
  const id = fileId.trim();
  let blob = null;

  try {
    const resposta = UrlFetchApp.fetch('https://drive.google.com/uc?export=download&id=' + id, {
      muteHttpExceptions: true,
      followRedirects: true,
    });
    if (resposta.getResponseCode() === 200) {
      const tipo = resposta.getBlob().getContentType() || '';
      if (tipo.indexOf('image') === 0) blob = resposta.getBlob();
      else Logger.log('O link não devolveu imagem (' + tipo + '): ' + titulo);
    } else {
      Logger.log('HTTP ' + resposta.getResponseCode() + ' ao buscar a imagem: ' + titulo);
    }
  } catch (erro) {
    Logger.log('Falha ao buscar por link (' + erro + '), tentando pelo Drive: ' + titulo);
  }

  if (!blob) {
    try {
      blob = DriveApp.getFileById(id).getBlob();
    } catch (erro) {
      Logger.log('ERRO — não consegui pegar a imagem "' + titulo + '": ' + erro);
      return;
    }
  }

  form.addImageItem().setTitle(titulo).setImage(blob).setAlignment(FormApp.Alignment.CENTER);
}

/**
 * Coloca cada imagem logo ACIMA da sua pergunta, no formulário que já existe.
 *
 * Procura a pergunta pelo começo do título, então funciona mesmo que o texto
 * tenha sido editado no fim. Se a imagem já estiver lá, ela é substituída.
 */
function adicionarImagens() {
  const form = FormApp.openById(FORM_ID);

  const blocos = [
    [IMAGENS.entender, 'Cinco telas iniciais do mesmo aplicativo', 'Olhando as telas acima'],
    [IMAGENS.tema, 'A mesma tela do aplicativo, clara e escura', 'Qual das duas é mais confortável'],
    [IMAGENS.evolucao, 'Quatro telas do mesmo aplicativo, mostrando o histórico de jeitos diferentes', 'Qual delas te mostra melhor'],
    [IMAGENS.estilos, 'O mesmo conteúdo, em quatro estilos visuais', 'Qual desses estilos'],
    [IMAGENS.densidade, 'Duas telas: uma com pouca informação, outra com muita', 'Numa tela, você prefere'],
  ];

  const feitas = [];
  blocos.forEach(function (bloco) {
    const id = (bloco[0] || '').trim();
    const legenda = bloco[1];
    const inicioDaPergunta = bloco[2];

    if (!id) {
      Logger.log('SEM IMAGEM — id não preenchido: ' + legenda);
      return;
    }

    // tira uma imagem igual que já esteja no formulário, para não duplicar
    form.getItems(FormApp.ItemType.IMAGE).forEach(function (item) {
      if (item.getTitle() === legenda) form.deleteItem(item);
    });

    const pergunta = form.getItems().filter(function (item) {
      return item.getTitle().indexOf(inicioDaPergunta) === 0;
    })[0];

    if (!pergunta) {
      Logger.log('PERGUNTA NÃO ENCONTRADA: ' + inicioDaPergunta);
      return;
    }

    let blob;
    try {
      blob = DriveApp.getFileById(id).getBlob();
    } catch (erro) {
      Logger.log('ERRO ao abrir a imagem "' + legenda + '": ' + erro);
      return;
    }

    const img = form.addImageItem().setTitle(legenda).setImage(blob)
      .setAlignment(FormApp.Alignment.CENTER);
    form.moveItem(img, pergunta.getIndex());
    feitas.push(legenda);
  });

  Logger.log('Imagens colocadas: ' + feitas.length + ' de ' + blocos.length);
  Logger.log('Abra o formulário: ' + form.getEditUrl());
}
