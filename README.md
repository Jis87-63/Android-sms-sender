# SMS Sender Pro

Aplicação local em **Node.js** para Android/Termux que envia SMS através do SIM do telefone usando `termux-sms-send` (Termux:API). Não usa gateway externo, créditos, Sender ID ou mecanismos para contornar limites da operadora. Use apenas contactos com consentimento e respeite a operadora.

## Requisitos

- Android com SIM capaz de enviar SMS e saldo/plano compatível.
- [Termux](https://f-droid.org/packages/com.termux/) e a aplicação complementar **Termux:API** instalados da mesma fonte (F-Droid ou GitHub; não misture fontes).
- Permissão **SMS** concedida à aplicação Termux:API quando o Android solicitar.
- Ligação à internet apenas para instalar/atualizar o projeto; o envio é local.

## Instalação do zero no Termux

1. Instale Termux e Termux:API no Android. Abra o Termux e execute:
   ```bash
   pkg update
   pkg upgrade
   pkg install nodejs git termux-api
   ```
2. Teste a integração (substitua pelo seu número de teste):
   ```bash
   termux-sms-send -n +258841234567 "Teste Termux API"
   ```
   Autorize SMS para Termux:API. Se o comando não existir, confirme que a app Termux:API está instalada e execute novamente `pkg install termux-api`.
3. Clone e instale dependências:
   ```bash
   git clone <URL-DO-SEU-REPOSITORIO> sms-sender-pro
   cd sms-sender-pro
   npm install
   cp config/config.example.json config/config.local.json
   npm run doctor
   npm start
   ```

`npm start` é o comando oficial. Depois de `npm run doctor` apresentar **Sistema pronto**, a instalação e o teste de diagnóstico foram concluídos com sucesso. Depois de selecionar a lista e mensagem, o painel oferece `[S] Simular/Testar`, que **nunca envia SMS**, e `[E] Envio real`, que só começa se escrever exatamente `ENVIAR`.

## Configuração

Edite `config/config.local.json` (é ignorado pelo Git):

```json
{"defaultCountryCode":"258","delayMs":1000,"maxRetries":0,"showProgress":true,"saveReports":true,"smsTimeoutMs":30000}
```

`defaultCountryCode` normaliza números locais de nove dígitos; `delayMs` tem mínimo de 1000 ms para respeitar a capacidade do aparelho e operadora. `smsTimeoutMs` (30 segundos por padrão) impede que uma chamada Termux:API presa bloqueie a campanha: o destinatário é registado como falha e o envio continua. `maxRetries` é guardado para compatibilidade, mas esta versão não reenvia automaticamente uma falha para evitar duplicação acidental. `saveReports` guarda resultados por campanha.

## Contactos e mensagens

Coloque ficheiros em `contacts/`. São detetados `.txt`, `.csv`, `.xlsx`, `.xls`, `.xlsm`, `.xlsb` e `.ods`. Ficheiros `.slsx` também são aceites para compatibilidade quando o conteúdo for uma planilha XLSX renomeada; prefira a extensão padrão `.xlsx`. TXT tem um número por linha. Em CSV/Excel, a aplicação reconhece `numero`, `número`, `phone`, `telefone`, `mobile`, `contact` e opcionalmente `nome`/`name`. Excel depende do pacote npm `xlsx`, instalado por `npm install`. Números inválidos nunca são enviados; repetidos são removidos após normalização.

Coloque mensagens `.txt` em `messages/`. Variáveis suportadas: `{numero}`, `{nome}`, `{data}`, `{hora}`, `{indice}`, `{total}`. Se não houver nome, `{nome}` recebe o número para evitar uma saudação vazia.

A blacklist em `blacklist/blacklist.txt` contém um número por linha. O menu permite listar, adicionar, remover e limpar. Contactos nela são excluídos antes de qualquer envio.

## Envio, progresso e relatórios

Cada destinatário é enviado sequencialmente por `termux-sms-send -n NUMERO MENSAGEM`; sucessos e falhas são registados individualmente. Após selecionar uma campanha, `[S]` executa exclusivamente a simulação/Dry Run e não chama a API nem envia SMS. O envio real exige `[E]` e a palavra completa `ENVIAR`, para evitar iniciar uma campanha por engano. Cada chamada tem limite de tempo configurável, para que uma API bloqueada não congele a campanha. Durante o envio, o painel redesenha uma barra de progresso própria do terminal com percentagem, velocidade, tempo decorrido/estimado, último resultado e controlos `[P]`, `[R]` e `[Q]` (pressione `Q` duas vezes para confirmar paragem). Dry Run percorre os mesmos contactos e cria relatório sem chamar a API.

Relatórios ficam em `reports/AAAA-MM-DD_HH-MM-SS/` com `success.csv`, `failed.csv`, `pending.csv` e `report.json`. Estes relatórios ficam fora do Git para proteger dados pessoais. Uma falha no Termux/Android é registada com a mensagem disponível; verifique permissões, SIM, saldo e sinal.

## Comandos

```bash
npm start        # painel
npm run doctor   # verifica Node, Termux, comando SMS, pastas e configuração
npm run test     # testes locais; não envia SMS
npm run sync     # git pull --ff-only seguro (recusa alterações locais)
npm run owner    # nome e WhatsApp do proprietário
```

## Atualização via GitHub

Antes de atualizar, guarde/commite as suas alterações. O comando seguro é:

```bash
npm run sync
npm install
```

Também pode usar `git pull --ff-only`; esse modo não tenta criar merge nem apagar configurações locais. `config/config.local.json` e `reports/` não são enviados ao Git.

## Solução de problemas

- **`termux-sms-send` não encontrado:** instale a app Termux:API compatível e rode `pkg install termux-api`.
- **Permissão negada/SMS não enviado:** em Android > Apps > Termux:API > Permissões, permita SMS; confirme SIM ativo, sinal e saldo. Execute o teste manual indicado acima.
- **Excel não abre:** confirme `npm install`; um Excel corrompido gera erro legível e não inicia envio.
- **CSV não reconhece coluna:** use cabeçalho aceite, como `nome,numero`; para uma coluna use TXT.
- **`npm run sync` recusa:** reveja `git status`, faça commit ou `git stash`; isto evita apagar trabalho local.
- **Envio fica preso:** aguarde o limite `smsTimeoutMs` (30 s por padrão); o contacto será marcado como falha e a campanha continua. Depois confirme permissões SMS, sinal e SIM.
- **Espaço insuficiente:** liberte armazenamento antes de executar, pois relatórios são guardados a cada destinatário.

O diagnóstico não envia SMS. Para uma verificação completa, rode `npm run doctor` dentro do Termux antes de cada primeira campanha.
