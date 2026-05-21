# Deploy remoto do LASTTRO

## Render

1. Suba este projeto para um repositorio no GitHub.
2. Entre em https://render.com e crie um **Blueprint** apontando para o repositorio.
3. O Render vai ler o arquivo `render.yaml`.
4. Depois do deploy, abra a URL gerada pelo Render.

O banco fica em JSON na pasta definida por `DATA_DIR`.

No plano gratuito do Render, discos persistentes nao sao aceitos. Por isso o `render.yaml` usa `DATA_DIR=data`, suficiente para testar o app remoto. Para uso real, o ideal e trocar depois para um banco externo ou um plano com disco persistente.

Login inicial:

- Email: `admin@lasttro.local`
- Senha: `lasttro123`

Depois de subir remoto, troque essa senha.
