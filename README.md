# clima-web

Interface web da [clima-api](https://github.com/marceloluizfranca/clima-api): mostra a previsão do tempo de hoje para uma cidade ou para a localização do navegador.

## Funcionalidades

- Busca por nome da cidade, com atalhos para capitais
- Previsão pela localização do navegador (geolocalização)
- Temperatura atual em relação à mínima e à máxima do dia, chance de chuva, precipitação e vento
- Busca guardada na URL, para compartilhar o link: `/?cidade=Recife` ou `/?lat=-8.05&lon=-34.9`
- Tema claro e escuro, seguindo o sistema, e layout adaptado para celular
- Versões do site e da API exibidas no rodapé

## Arquitetura

Site estático (HTML, CSS e JavaScript, sem build e sem dependências), servido por um nginx sem root.

```
navegador ──▶ clima-web (nginx, NodePort 30080)
                ├─ /                         arquivos do site
                ├─ /healthz                  probe do Kubernetes
                └─ /v1/*, /docs, /readyz ──▶ clima-api (ClusterIP)
```

O navegador fala só com o nginx, que encaminha as rotas da API para o Service `clima-api` dentro do cluster. Com isso:

- a API não precisa ser exposta fora do cluster;
- não há configuração de CORS, porque site e API ficam na mesma origem;
- `localhost:30080` serve a interface e também a API (`/v1/...` e `/docs`).

O endereço da API vem da variável `API_UPSTREAM`. O nginx resolve esse nome a cada requisição, então sobe normalmente mesmo que a API ainda não exista; nesse caso as rotas da API respondem `502`.

## Desenvolvimento local

Suba a API e o site na mesma rede Docker:

```bash
docker network create clima
docker run -d --name api --network clima ghcr.io/marceloluizfranca/clima-api:latest
docker build -t clima-web:local .
docker run --rm --network clima -e API_UPSTREAM=api:8000 -p 8080:8080 clima-web:local
```

Acesse http://localhost:8080.

## Pipeline

O workflow `.github/workflows/ci-cd.yaml` tem três jobs:

1. **testes**: gera a imagem, sobe o container e verifica as rotas do site, a probe e o `502` quando a API está fora do ar.
2. **imagem**: em push na `main` ou em tag `vX.Y.Z`, gera a imagem arm64 e publica em `ghcr.io/marceloluizfranca/clima-web` com as tags `sha-<commit>`, `latest` e a versão semver.
3. **deploy**: roda no runner self-hosted `clima-web`, dentro do cluster kind. Aplica `k8s/` com a imagem do commit e espera o rollout terminar.

## Segurança

- **Container sem privilégios:** roda como usuário `101`, com sistema de arquivos somente leitura e todas as capabilities removidas.
- **Cabeçalhos de segurança:** `Content-Security-Policy` só permite recursos da própria origem. Também envia `X-Content-Type-Options` e `Referrer-Policy`.
- **Página sem HTML injetado:** o JavaScript não usa `innerHTML`. Os dados da API entram na página só como texto.

## Integração com a plataforma

O cluster, os runners e a stack de monitoramento são mantidos no repositório [devops](https://github.com/marceloluizfranca/devops). Esta aplicação foi integrada seguindo o guia [Adicionar um repositório](https://github.com/marceloluizfranca/devops/blob/main/github-runners/README.md#adicionar-um-repositório), com:

| Variável | Valor |
|---|---|
| `REPO` | `clima-web` |
| `DONO` | `marceloluizfranca` |
| `NAMESPACE` | `clima` (o mesmo da API; o namespace já existia) |
| `SCALE_SET` | `clima-web` |

## Versionamento

Commits seguem o [Conventional Commits](https://www.conventionalcommits.org/pt-br/) e as versões seguem o [SemVer](https://semver.org/lang/pt-BR/).
