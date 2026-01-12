PrintManager – Gestão de Dispositivos e Insumos
Descrição

O PrintManager é uma solução interna desenvolvida para o monitoramento em tempo real do status de impressoras térmicas, além do controle automatizado de estoque de etiquetas e ribbons. O sistema centraliza informações operacionais e facilita o acompanhamento da disponibilidade de dispositivos e insumos.

Tecnologias Utilizadas

Frontend: React.js com Recharts para visualização de dashboards

Backend: Node.js com Express

Banco de Dados: SQLite3 (persistência local)

Infraestrutura: Docker e Docker Compose

Instalação e Execução

Para executar o sistema em ambiente de produção, siga os passos abaixo:

Certifique-se de que o Docker Desktop esteja em execução.

Acesse a pasta raiz do projeto.

Execute o comando de build e inicialização:

docker-compose up -d --build


Acesse a aplicação pelo navegador:

http://localhost:7860

ou http://[IP-DO-SERVIDOR]:7860

Estrutura de Pastas

/frontend: Código-fonte da interface em React.

/uploads: Diretório temporário para processamento de planilhas Excel.

server.js: Servidor de API e lógica de monitoramento (ping dos dispositivos).

database.db: Arquivo de banco de dados SQLite.

Credenciais Padrão

Usuário: admin

Senha: discra