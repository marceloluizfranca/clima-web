FROM nginxinc/nginx-unprivileged:1.30-alpine

ARG APP_VERSION=dev

COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY site/ /usr/share/nginx/html/

# Versão exibida no rodapé da página
USER root
RUN printf '{"versao":"%s"}\n' "$APP_VERSION" > /usr/share/nginx/html/versao.json
USER 101

# NGINX_ENTRYPOINT_LOCAL_RESOLVERS preenche NGINX_LOCAL_RESOLVERS com o DNS do container
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1 \
    API_UPSTREAM=clima-api.clima.svc.cluster.local:80

EXPOSE 8080
