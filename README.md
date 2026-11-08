# 💊 Lembrete de Remédios

Protótipo de aplicativo para lembrar pacientes de tomar seus medicamentos, mostrando **qual remédio tomar e em qual horário**.

O app tem duas áreas:

- **🩺 Médico** – cadastra os medicamentos de cada paciente, acompanha os boletins de saúde e pode encerrar tratamentos.
- **🧑 Paciente** – vê as doses do dia, recebe alertas na hora certa, registra cada dose e envia um boletim diário de saúde.

## ▶️ Como acessar

**Abra o link do app: https://kayorigo.github.io/TrabalhoEgenhariaDeSoftware/**

Não é preciso instalar nada. Funciona no navegador do computador ou do celular.

### Teste rápido (1 minuto)
1. Na tela inicial, clique em **"Carregar dados de exemplo"**.
2. Clique em **Sou Paciente** e entre com o nome **Maria Silva** (ou **João Pereira**).
3. Veja as doses do dia e use **Tomei / Adiar / Ignorar**.
4. Volte e clique em **Sou Médico**: selecione a paciente no filtro para ver a **interação grave** entre Sinvastatina e Claritromicina.
5. Ainda na área do médico, cadastre **Ibuprofeno** para a **Maria Silva**: o alerta de interação com a Losartana aparece **antes** de salvar. Para ver o alerta **grave**, cadastre **Varfarina** e depois **AAS** para um mesmo paciente.

> Os dados ficam salvos apenas no navegador de quem usa (não há servidor).

## ✅ Requisitos atendidos

| ID | Requisito | Como foi implementado |
|---|---|---|
| RF01 | Cadastrar medicamento | Nome, tipo de medicação, dosagem, quantidade, horários, duração e instruções |
| RF02 | Agendar horários | Primeiro horário + frequência (4/4h, 6/6h, 8/8h, 12/12h, diário) ou horários avulsos |
| RF03 | Disparar notificações | No horário exato: janela de alerta, som, vibração (celular) e notificação do sistema |
| RF04 | Registrar confirmação | Botões **Tomei**, **Adiar** e **Ignorar**, com opção de desfazer |
| RF05 | Checar interação | Verificação automática entre os remédios em uso do paciente |
| RF06 | Detalhes da interação | Gravidade (Leve / Moderada / Grave), tipo de efeito e explicação simples |
| RNF01 | Notificação offline | Funciona sem internet após o primeiro acesso (Service Worker / PWA) |
| RNF02 | Desempenho | Checagem local em menos de 1 ms (o tempo aparece no alerta) |
| RNF03 | Privacidade (LGPD) | Dados de saúde criptografados com AES-GCM 256 (Web Crypto) |
| RNF04 | Acessibilidade | Fontes grandes, alto contraste, botões de toque grandes e botão **A+** |
| RN01 | Alerta de conflito | Interação grave abre aviso em destaque **antes de salvar**, exigindo confirmação |
| RN02 | Disclaimer | Todo alerta de interação informa que o app não substitui a consulta médica |
| RN03 | Tolerância de adiamento | Só é possível adiar até 60 minutos após o horário original |
| RST02 | Plataforma mobile | Layout para celular e pode ser instalado na tela inicial (PWA) |

### Funcionalidades extras
- Login do paciente apenas pelo nome (sem senha), sem opção de trocar de paciente.
- **Boletim diário de saúde**: o paciente informa como se sente, se melhorou ou piorou, sintomas e um relato livre; o médico vê todos os boletins.
- O médico pode **concluir ou interromper** um tratamento antes do prazo (o paciente é avisado) e reativá-lo.
- Exclusão e encerramento de medicamentos só são permitidos com um paciente específico selecionado.

## ⚠️ Limitações do protótipo

- **RST01 – API de interações:** não havia uma API farmacológica homologada disponível. Foi usada uma **base local simulada** com 14 interações conhecidas (`interacoes.js`), preparada para ser trocada pela API real. **Não deve ser usada para decisões clínicas.**
- **RST02 / RNF01:** é um app web adaptado para celular. Os alertas disparam com o app aberto; para notificar com o app fechado seria necessário um app nativo (ex.: React Native ou Flutter).
- **RNF03 x login sem senha:** os dados são criptografados no aparelho, mas como não há senha, quem abrir o app no mesmo aparelho consegue ver os dados.
- **Sem servidor:** médico e paciente precisam usar o mesmo navegador/aparelho para compartilhar os dados.

## 🗂️ Estrutura dos arquivos

| Arquivo | Função |
|---|---|
| `index.html` | Tela inicial (escolha Médico ou Paciente) e dados de exemplo |
| `medico.html` | Área do médico |
| `paciente.html` | Área do paciente |
| `dados.js` | Armazenamento criptografado e funções compartilhadas |
| `interacoes.js` | Base e checagem de interações medicamentosas |
| `style.css` | Visual e acessibilidade |
| `sw.js`, `manifest.json`, `icon.svg` | Funcionamento offline e instalação no celular |

Feito com HTML, CSS e JavaScript puro, sem bibliotecas externas.
