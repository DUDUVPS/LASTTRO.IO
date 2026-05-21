# Deploy remoto do LASTTRO

## Render

1. Suba este projeto para um repositorio no GitHub.
2. Entre em https://render.com e crie um **Blueprint** apontando para o repositorio.
3. O Render vai ler o arquivo `render.yaml`.
4. Depois do deploy, abra a URL gerada pelo Render.

O banco fica em JSON na pasta definida por `DATA_DIR`. No Render, o `render.yaml` cria um disco persistente em `/var/data`, entao os dados nao devem zerar a cada reinicio.

Login inicial:

- Email: `admin@lasttro.local`
- Senha: `lasttro123`

Depois de subir remoto, troque essa senha.
