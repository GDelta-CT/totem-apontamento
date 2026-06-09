# Deploy do GDelta Totem em VPS (Ubuntu + Docker)

> A VPS hospeda **só o app Next.js**. O banco continua no **Supabase (nuvem)** — não há
> banco pra migrar. HTTPS automático via Caddy.

## 0. Pré-requisitos (você)
- VPS Ubuntu com acesso root (SSH) e o **IP**.
- Um **domínio** + 1 registro **DNS A**: `totem.seudominio.com.br` → IP da VPS.
- A **anon key** do projeto Supabase (a mesma do `.env.local`).

## 1. Docker
```bash
curl -fsSL https://get.docker.com | sh
docker --version && docker compose version
```

## 2. Subir o código
```bash
mkdir -p /opt/gdelta-totem && cd /opt/gdelta-totem
# Opção A — git: git clone SEU_REPO .
# Opção B — copiar do PC:  scp -r "C:\Users\Eliel\Documents\GDelta-Totem" root@SEU_IP:/opt/gdelta-totem/
```

## 3. Configurar e subir
```bash
cd /opt/gdelta-totem/deploy
cp .env.example .env
nano .env          # preencha SUPABASE URL/ANON KEY, TOTEM_DOMAIN, CADDY_EMAIL
docker compose up -d --build      # ~2-4 min no primeiro build
docker compose logs -f caddy      # acompanhe a emissão do certificado
```

## 4. Conferir
- `https://totem.seudominio.com.br/totem` (chão de fábrica)
- `https://totem.seudominio.com.br/admin` (painel do dono)
> O Caddy só emite o certificado **depois** que o DNS estiver apontando pro IP.

## Dia a dia
```bash
cd /opt/gdelta-totem/deploy
docker compose up -d --build   # aplicar nova versão do app
docker compose ps              # status
docker compose logs -f totem   # logs do app
docker compose restart totem   # reiniciar
docker compose down            # parar (mantém volumes do Caddy)
```

## Atualizar o app
Após `git pull` (ou novo `scp`), rode `docker compose up -d --build` — reconstrói a imagem
com o código novo. As NEXT_PUBLIC_* são lidas do `.env` em build-time.

## Firewall (recomendado)
```bash
apt -y install ufw && ufw allow OpenSSH && ufw allow 80,443/tcp && ufw --force enable
```

## Espelho do pátio na planilha (opcional)
A rota `POST /api/sync/patio` lê as OS ativas da oficina no Supabase e escreve numa aba
dedicada da planilha (`Totem · Pátio`), sem tocar no dashboard do dono. Para ligar:
1. Preencha no `.env` o bloco **SYNC** (segredo, service role, chave da Service Account,
   `SYNC_SHEET_ID`, `SYNC_OFICINA_ID`). A planilha precisa estar compartilhada com o e-mail
   da Service Account como **Editor**.
2. `docker compose up -d` (recarrega o `.env`).
3. Teste uma vez:
   ```bash
   curl -fsS -X POST -H "x-sync-secret: SEU_SYNC_SECRET" https://totem.seudominio.com.br/api/sync/patio
   # esperado: {"ok":true,"oficina_id":"...","aba":"Totem · Pátio","linhas":N}
   ```
4. Agende a cada 10 min (cron na VPS):
   ```bash
   ( crontab -l 2>/dev/null; echo '*/10 * * * * curl -fsS -X POST -H "x-sync-secret: SEU_SYNC_SECRET" https://totem.seudominio.com.br/api/sync/patio >> /var/log/gdelta-sync.log 2>&1' ) | crontab -
   ```
> Multi-oficina (futuro): trocar `SYNC_OFICINA_ID`/`SYNC_SHEET_ID` de env por uma coluna
> `gsheet_id` na tabela `oficinas` e iterar as oficinas — migration aditiva, sob aprovação.
