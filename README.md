# Morok-AI

## Morok

Morok é um assistente pessoal inteligente desenvolvido para centralizar conversação, memória, ferramentas, arquivos, automações e integrações em uma única aplicação.

O projeto está organizado nas fases **0, 1, 2, 4 e 5**. A numeração mantém o planejamento original do projeto.

### Legenda de status

- 🔴 **Não implementado**
- 🟡 **Em andamento / parcialmente implementado**
- 🟢 **Concluído e validado**

> **Regra de leitura:** um recurso só é considerado concluído quando existe implementação correspondente no repositório e sua execução foi validada. A existência de arquivos, rotas ou configurações isoladas não é suficiente.

---

# FASE 0 — FUNDAÇÃO

**Status: 🟢 Concluída no código-base**

A fundação do monorepo está implementada. O repositório possui frontend React/Vite, backend Fastify/TypeScript, pacote compartilhado, persistência MongoDB, configuração de ambiente, testes e workflows de CI.

### O que realmente existe

- 🟢 Monorepo com npm Workspaces
- 🟢 Node.js 22+
- 🟢 TypeScript
- 🟢 React 19
- 🟢 Vite
- 🟢 Fastify
- 🟢 MongoDB
- 🟢 Pacote compartilhado
- 🟢 Configuração central do backend
- 🟢 CORS configurável
- 🟢 Health check da API
- 🟢 Health check do MongoDB
- 🟢 Encerramento seguro do backend
- 🟢 Testes unitários/de domínio
- 🟢 Testes de integração
- 🟢 Typecheck/build automatizados
- 🟢 Prettier
- 🟢 EditorConfig
- 🟢 .gitignore
- 🟢 GitHub Actions
- 🟢 Estrutura de frontend e backend
- 🟢 Base para expansão multiplataforma

### Infraestrutura

- 🟢 Configuração para Render no repositório
- 🟢 Variáveis de ambiente sem secrets versionados
- 🟢 MongoDB configurável por `MONGODB_URI`
- 🟢 Serviço Ollama separado em `apps/ollama`
- 🟢 Dockerfile para Ollama
- 🟢 Script de inicialização do Ollama
- 🟢 Proxy Nginx com autenticação para o Ollama
- 🟢 Modelo padrão definido como `qwen2.5:0.5b`

### Observação sobre produção

A infraestrutura externa não é considerada concluída apenas pela existência da configuração no Git. Render, MongoDB, credenciais, secrets e disponibilidade do modelo precisam ser validados no ambiente de produção.

O `render.yaml` usa o serviço público `morok-ollama.onrender.com`, protegido por autenticação, porque serviços Web Free do Render não recebem tráfego privado. A API aponta explicitamente para esse endpoint e o ambiente de produção usa o banco `MorokAI`.

---

# FASE 1 — INÍCIO DA APLICAÇÃO

**Status: 🟡 Em andamento — núcleo funcional implementado, validação e integração ainda em andamento**

A maior parte do núcleo da primeira aplicação já existe no repositório. A Fase 1 **não deve ser marcada como 100% concluída** enquanto as integrações externas, produção e todos os fluxos da interface não estiverem validados.

## 1.1 — Interface web

- 🟢 Aplicação React/Vite
- 🟢 Interface principal
- 🟢 Área de conversa
- 🟢 Campo de comando
- 🟢 Histórico/conversa
- 🟢 Estados de processamento
- 🟢 Estados de execução
- 🟢 Estados de erro
- 🟢 Configurações e estados da aplicação
- 🟢 Interface responsiva
- 🟢 Identidade visual do Morok
- 🟢 Elementos visuais do núcleo/holograma
- 🟢 Assets do Morok
- 🟢 Ícone/logo do aplicativo

## 1.2 — Conversação

- 🟢 Mensagens de usuário e assistente
- 🟢 Histórico de conversa
- 🟢 Contexto de conversa
- 🟢 Detecção de intenção
- 🟢 Comandos
- 🟢 Respostas contextuais
- 🟢 Streaming de resposta
- 🟢 Cancelamento/interrupção de execução no fluxo da interface
- 🟡 Validação completa com modelo remoto/local em produção

## 1.3 — Voz

- 🟢 Entrada por voz com APIs nativas do navegador
- 🟢 `SpeechRecognition` / `webkitSpeechRecognition`
- 🟢 Captura persistente de `MediaStream`
- 🟢 Controle centralizado do microfone
- 🟢 Recuperação do serviço de reconhecimento
- 🟢 Saída por voz com `speechSynthesis`
- 🟡 Compatibilidade depende do navegador e das APIs de voz disponíveis
- 🟡 Validação completa em dispositivos móveis ainda pendente

## 1.4 — Inteligência e Model Gateway

- 🟢 Contrato de Model Gateway
- 🟢 API compatível com OpenAI Chat Completions
- 🟢 Mensagens de sistema, usuário e assistente
- 🟢 Histórico enviado ao modelo
- 🟢 Contexto/memórias enviado ao modelo
- 🟢 Streaming
- 🟢 Fallback de provedor
- 🟢 Configuração de temperatura
- 🟢 Timeout
- 🟢 Autenticação Basic Auth para o gateway Ollama
- 🟢 Modelo padrão `qwen2.5:0.5b`
- 🟢 Endpoint de status do modelo
- 🟡 Serviço Ollama em Render ainda depende de configuração/secrets e validação de deploy

## 1.5 — Autenticação e sessões

- 🟢 Autenticação
- 🟢 Sessões
- 🟢 Tokens de sessão
- 🟢 Associação de sessão ao usuário
- 🟢 Verificação de autorização nas rotas protegidas
- 🟢 Permissões
- 🟢 Auditoria

## 1.6 — Memória e contexto

- 🟢 Memória persistente
- 🟢 Contexto
- 🟢 Identidade do Morok
- 🟢 Preferências/contexto de usuário
- 🟢 Histórico
- 🟢 Pesquisa/recuperação de memória
- 🟡 Validação completa dos fluxos de retenção e gerenciamento de memória

## 1.7 — Ferramentas e comandos

- 🟢 Registro/estrutura de ferramentas
- 🟢 Comandos
- 🟢 Permissões
- 🟢 Execução através das estruturas do backend
- 🟢 Tratamento de erros
- 🟢 Auditoria

## 1.8 — Arquivos e documentos

- 🟢 Arquivos
- 🟢 Listagem
- 🟢 Criação
- 🟢 Leitura/uso pelo backend
- 🟢 Documentos
- 🟢 Criação de documentos
- 🟢 Leitura de documentos
- 🟢 Atualização
- 🟢 Exclusão
- 🟢 Formatos text, Markdown, JSON, CSV e HTML
- 🟢 Limite configurável de tamanho de arquivo
- 🟡 Upload/download e fluxos avançados ainda precisam de validação completa na aplicação

## 1.9 — Web

- 🟢 Pesquisa web
- 🟢 Abertura/leitura web
- 🟢 Timeout configurável
- 🟡 Automação completa de navegador, abas, formulários e interação visual ainda não pertence à Fase 1 implementada

## 1.10 — Organização

- 🟢 Tarefas
- 🟢 Conclusão de tarefas
- 🟢 Exclusão de tarefas
- 🟢 Planejamento
- 🟢 Agenda/calendário na camada de domínio
- 🟢 Contatos na camada de integração
- 🟢 Notificações na camada de integração
- 🟢 Agendamento de automações
- 🟢 Histórico de execuções
- 🟡 Integrações externas reais dependem das credenciais e serviços correspondentes

## 1.11 — Cofre e segurança

- 🟢 Cofre de credenciais
- 🟢 Criptografia de valores armazenados
- 🟢 Controle por usuário
- 🟢 Permissões
- 🟢 Auditoria
- 🟢 Configuração por secret de ambiente
- 🟡 Validação de produção ainda necessária

## 1.12 — Integrações

- 🟢 Estrutura de integrações
- 🟢 Cadastro de integração
- 🟢 Ativação/desativação
- 🟢 Envio através de integração
- 🟢 Armazenamento protegido de segredo
- 🟡 Conectores reais de provedores externos ainda dependem de configuração e validação

## 1.13 — Android

- 🟢 Capacitor configurado
- 🟢 Dependência Android do Capacitor
- 🟢 Workflow de build Android
- 🟢 Geração de projeto Android durante o workflow
- 🟢 Build de APK debug
- 🟢 Upload do APK como artefato
- 🟢 Publicação de Release pelo workflow
- 🟢 Configuração do `MorokLogo.png` como ícone quando presente
- 🟡 Aplicativo Android ainda é principalmente o cliente web empacotado; os recursos de assistente de sistema da Fase 2 ainda não estão implementados

## 1.14 — Atualizações

- 🟢 Estrutura de verificação de versão para o aplicativo nativo existe no cliente
- 🟢 Verificação é direcionada às plataformas nativas
- 🟡 Sistema completo de atualização automática ainda não deve ser considerado concluído

### Resultado atual da Fase 1

A Fase 1 possui um **núcleo funcional amplo**, mas permanece 🟡 porque ainda existem dependências externas e fluxos que precisam de validação real. O código já cobre autenticação, sessões, conversa, memória, contexto, intenção, gateway de modelo, streaming, voz, tarefas, planejamento, arquivos, documentos, integrações, automações, auditoria e preparação Android.

---

# FASE 2 — TRANSFORMAÇÃO EM ASSISTENTE DE SISTEMA

**Status: 🔴 Não implementada — apenas preparação multiplataforma existente**

A Fase 2 começa quando o Morok passa a operar efetivamente o sistema operacional e dispositivos autorizados.

### Preparação já existente

- 🟢 Capacitor/Android preparado
- 🟢 Build automatizado de APK
- 🟢 Estrutura web reutilizável em aplicativo
- 🟢 Base de integração para dispositivos

### Ainda não implementado

- 🔴 Controle de teclado
- 🔴 Controle de mouse
- 🔴 Controle de janelas
- 🔴 Controle de aplicativos do sistema
- 🔴 Controle completo do sistema operacional
- 🔴 Overlay desktop
- 🔴 Atalhos globais
- 🔴 Execução nativa em segundo plano
- 🔴 Controle completo de terminal
- 🔴 Visão computacional operacional para controle do computador
- 🔴 Controle remoto entre dispositivos
- 🔴 Integração nativa completa Android
- 🔴 Integração nativa iOS
- 🔴 Aplicativo desktop Linux/Crostini completo

---

# FASE 4 — IMPLEMENTAÇÃO, EXPANSÃO E REVISÃO GERAL

**Status: 🔴 Não iniciada como fase de expansão**

A Fase 4 será usada para ampliar o Morok além do núcleo inicial, integrar recursos avançados e revisar todo o sistema.

### Planejado

- 🔴 Inteligência avançada
- 🔴 Autonomia
- 🔴 Visão computacional
- 🔴 Controle avançado de computador
- 🔴 Automação avançada
- 🔴 Integrações externas em escala
- 🔴 Plugins
- 🔴 Skills
- 🔴 IoT
- 🔴 Automação residencial
- 🔴 Controle avançado de dispositivos
- 🔴 Continuidade entre dispositivos
- 🔴 Programação assistida
- 🔴 Git/GitHub operacional pelo Morok
- 🔴 Monitoramento avançado
- 🔴 Modos de operação
- 🔴 Privacidade avançada
- 🔴 Modo offline/local completo
- 🔴 Autonomia contínua
- 🔴 Revisão completa de todas as funcionalidades

---

# FASE 5 — TÉRMINO DA APLICAÇÃO

**Status: 🔴 Não iniciada**

A Fase 5 será executada quando as funcionalidades principais estiverem completas.

### Planejado

- 🔴 Estabilização
- 🔴 Otimização
- 🔴 Testes completos
- 🔴 Testes multiplataforma
- 🔴 Auditoria de segurança
- 🔴 Auditoria de privacidade
- 🔴 Produção definitiva
- 🔴 Backups
- 🔴 Recuperação
- 🔴 Monitoramento contínuo
- 🔴 Builds finais
- 🔴 Assinatura dos aplicativos
- 🔴 Distribuição
- 🔴 Onboarding
- 🔴 Documentação final
- 🔴 Release estável
- 🔴 Operação contínua

---

# STATUS REAL ATUAL

| Fase | Status | Situação real |
|---|---|---|
| **Fase 0 — Fundação** | 🟢 | Fundação do código concluída |
| **Fase 1 — Início da aplicação** | 🟡 | Núcleo amplo implementado; integração/validação ainda em andamento |
| **Fase 2 — Assistente de sistema** | 🔴 | Preparação Android existente, controle do sistema ainda não implementado |
| **Fase 4 — Expansão e revisão** | 🔴 | Ainda não iniciada |
| **Fase 5 — Término** | 🔴 | Ainda não iniciada |

## O que já existe de forma concreta

O repositório atualmente possui:

- 🟢 Frontend React/Vite
- 🟢 Backend Fastify/TypeScript
- 🟢 MongoDB
- 🟢 Autenticação e sessões
- 🟢 Memória e contexto
- 🟢 Intenção e comandos
- 🟢 Permissões
- 🟢 Auditoria
- 🟢 Model Gateway
- 🟢 Streaming
- 🟢 Ollama/Qwen 2.5 0.5B preparado
- 🟢 Proxy autenticado para Ollama
- 🟢 Conversação por voz
- 🟢 Síntese de voz
- 🟢 Tarefas
- 🟢 Planejamento
- 🟢 Calendário
- 🟢 Contatos
- 🟢 Notificações
- 🟢 Arquivos
- 🟢 Documentos
- 🟢 Pesquisa/leitura web
- 🟢 Automações e agendamento
- 🟢 Cofre de credenciais
- 🟢 Integrações
- 🟢 Cliente Android via Capacitor
- 🟢 Workflow de APK
- 🟢 GitHub Actions para CI
- 🟢 GitHub Pages
- 🟢 Assets visuais do Morok

## O que não deve ser considerado pronto ainda

- 🔴 Assistente de sistema completo
- 🔴 Controle nativo de computador
- 🔴 Controle remoto de dispositivos
- 🔴 Visão computacional operacional para automação
- 🔴 Desktop nativo completo
- 🔴 iOS nativo completo
- 🔴 Ecossistema completo de plugins/skills
- 🔴 IoT e automação residencial
- 🔴 Autonomia contínua
- 🔴 Produção final
- 🔴 Release estável multiplataforma

## Princípios do projeto

- O Morok deve permanecer modular.
- O núcleo deve ser independente da interface.
- Inteligência, execução, memória, ferramentas, segurança e interfaces devem permanecer separadas.
- Secrets nunca devem ser versionados.
- Recursos críticos devem respeitar permissões e confirmações apropriadas.
- Ações relevantes devem ser auditáveis.
- Falhas devem possuir recuperação segura quando possível.
- Uma funcionalidade só deve ser marcada como concluída após validação.
- O README deve refletir o estado real do repositório, e não apenas o planejamento.
- A aplicação web é a primeira interface; a arquitetura deve permitir evolução para aplicativos.
- O desenvolvimento deve priorizar implementação real sobre arquivos de demonstração.

## Visão

Construir o Morok como um assistente pessoal multiplataforma capaz de conversar, compreender contexto, utilizar ferramentas, acessar informações, executar tarefas, automatizar processos e, posteriormente, operar dispositivos e sistemas autorizados em um único ecossistema.
