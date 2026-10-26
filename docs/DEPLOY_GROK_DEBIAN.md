# ElderCare AI 测试部署交接：Debian 13 / Grok Bot

适用目标：把当前 Fork 的后端和三语言网页部署到 Grok Bot 的 Debian 机器，先用于测试与演示。本文复用仓库现有 Quick Start，不新增部署框架，也不在用户的 Windows 电脑上安装软件。

目标机器之前报告为 Debian 13、8 核 Xeon、约 15 GB 内存（可用约 6.5 GB）、105 GB 剩余磁盘。**这只是用户提供的信息，执行者必须现场核对，并确认磁盘是否持久、机器是否会被平台回收。**

## 可直接交给 Grok Bot 的任务

> 请读取并执行本说明，在你自己的 Debian 机器部署 ElderCare AI 测试版。
>
> 仓库：`https://github.com/SydneyMCDonaldbigking/Watch2Whoop.git`；分支：`feat/elder-care-mvp`。不要部署 upstream 的 main；功能代码至少包含 `6826c1a`，启动前报告实际 commit。
>
> 先检查 Docker、Compose、资源、持久磁盘及网络访问能力，再复用 `python3 quickstart/run.py up --tz Australia/Sydney`。使用合成数据，不导入真实健康数据，不接入付费 AI，不启用 Grafana，不修改业务代码或降低鉴权要求。
>
> 如果 Docker/Compose 不存在或没有 Docker daemon 权限，先报告缺什么、需要安装什么或需要什么权限，等我确认；不要安装 WSL、CUDA、本地大模型或绕过平台限制。
>
> 默认只监听本机。先完成本机验证，再说明我如何从外面访问；优先使用已有的 SSH、私网或平台提供的受控转发。新增公网隧道、账号授权或开放端口前先告诉我。不要把 localhost 冒充外网网址。
>
> 完成后按本文最后的验收模板回复。失败时贴脱敏后的错误和阻塞原因，保留数据；不要运行 reset、down -v、清理 Docker volumes、强制覆盖文件或改用 latest 镜像。

## 1. 本次部署能提供什么

- Body Engine / FastAPI、PostgreSQL，以及同一后端提供的网页。
- Open Wearables API、worker、beat；SparkyFitness 前后端及数据库；Redis。
- 现有脚本导入的 60 天**合成示例数据**，用于查看恢复、睡眠、活动和趋势。
- 中文 / English / 日本語语言选择、大字模式。日语覆盖主要界面，其他内容暂回退到英文。

这不是只跑两个容器的轻量空壳。现有默认 Quick Start 有 10 个服务，Grafana 是额外可选项，本次不启用。上游 README 的参考要求约为 4 GB 空闲内存、6 GB 磁盘；镜像缓存、构建和实际占用会变化，须以现场测量为准。

本次不代表真实 Apple Watch 已同步、AI 模型已配置、家属授权/用药功能已实现，或服务已有持续在线保证。Quick Start 的演示账号有 owner 权限，只用于这套合成数据。

## 2. 执行前检查

以下命令在 **Grok Bot 的 Linux 终端**执行：

```bash
cat /etc/os-release
uname -m
id
free -h
df -h .
python3 --version
git --version
docker version
docker info
docker compose version
docker buildx version
```

要求：

1. `docker info` 成功，当前使用的是预期的本机 Docker daemon；不要擅自切换 Docker context。
2. Compose 支持 `additional_contexts`，最低为 2.17；仓库 Dockerfile 构建依赖 `packages/openbodyscore` 这个额外 context。
3. 主机 Python ≥3.9 仅运行 Quick Start 的标准库脚本。后端自身要求 Python 3.12，由现有 Dockerfile 提供；**不要用主机 Python 3.13 直接安装后端依赖**。
4. 能访问 GitHub 和仓库镜像源，磁盘可持久保存。没有 Docker daemon、容器嵌套能力或必要权限时，报告具体阻塞，不尝试 privileged 容器、挂载别人的 Docker socket 或修改宿主权限来绕过限制。
5. 如果存在同名项目或端口正在使用，先确认归属，复用已确认的部署或改用新目录/项目名；不要停止别人的服务。

Docker 官方支持 Debian 13；需要安装时，在得到用户确认后遵循 [Docker Engine for Debian 官方说明](https://docs.docker.com/engine/install/debian/)。不要自动卸载现有 Docker/containerd、修改防火墙或执行安装脚本。

## 3. 获取正确代码

首次部署使用新目录；目录已存在时，这一段会停止，避免覆盖。

```bash
set -eu
umask 077

ELDERCARE_PROJECT_ROOT="$HOME/projects/Watch2Whoop-eldercare"
mkdir -p "$HOME/projects"
if [ -e "$ELDERCARE_PROJECT_ROOT" ]; then
  printf '%s\n' "Target exists. Inspect its Git status and deployment state before reusing it."
  exit 1
fi

git clone --branch feat/elder-care-mvp --single-branch \
  https://github.com/SydneyMCDonaldbigking/Watch2Whoop.git \
  "$ELDERCARE_PROJECT_ROOT"
cd "$ELDERCARE_PROJECT_ROOT"

git status --short
git branch --show-current
git remote -v
git rev-parse HEAD
git merge-base --is-ancestor 6826c1a HEAD
test -f body_engine/src/body_engine/web/static/i18n-ja.js
test -f body_engine/src/body_engine/web/static/elder-mode.js
test -f body_engine/src/body_engine/migrations/850_japanese_language.sql
```

`git merge-base` 返回非零时停止，检查是否拉错仓库/分支。无需拉取 Open Wearables 子模块来运行此 Quick Start，因为它使用已固定的镜像。

对于已有工作目录：先检查 `git status`、remote、分支和运行中的 Compose 项目；工作区干净且确认属于本部署后，才允许 `git pull --ff-only origin feat/elder-care-mvp`。遇到本地改动或分叉，保留现场并报告，不 reset / force pull。

## 4. 启动测试栈

下面从仓库根目录执行。不要先运行根目录的 `docker compose up`：根 compose 是另一套生产布局，需要预先配置的外部服务和 secrets。

```bash
python3 quickstart/run.py up --tz Australia/Sydney
```

初次会下载镜像、构建后端、生成私密配置、初始化服务和示例账号、导入合成数据、计算分数，最后打印一次性登录链接。实际耗时取决于网络与机器，不能把进程启动当成部署成功。

- 不加 `--grafana`，不启动本地模型。
- 所有服务已有 `restart: unless-stopped`；后台运行由 Docker 管理，不需要 `nohup` 包住网页服务器。
- `body-engine` 容器默认先运行 `body-engine migrate`，因此会应用 `850_japanese_language.sql`，再启动 Uvicorn；无需手工改数据库 CHECK。
- 保留 Dockerfile 和 compose 中的固定版本/镜像摘要。出现 `manifest unknown`、digest 不存在、拉取失败或锁文件错误时，报告镜像名和脱敏错误；不要擅自改为 `latest` 或升级依赖。
- 脚本失败后先看日志。其初始化设计为可重跑，但不要同时启动第二份初始化，也不要通过 reset 清掉现场。

已有部署可能占用默认项目名。确认需要第二套独立部署时，**首次运行前**可以指定独立名称和端口，例如：

```bash
W2W_PROJECT=eldercare-grok-test W2W_BODY_PORT=19100 \
  W2W_OW_PORT=19200 W2W_SF_PORT=19300 \
  python3 quickstart/run.py up --tz Australia/Sydney
```

这些值首次写入 `quickstart/.data/quickstart.env` 后会被保留。不要在运行中重命名项目或盲改端口；读取实际配置和映射为准。

## 5. 验证后端和迁移

在仓库根目录定义一个与原脚本相同的 Compose 包装函数：

```bash
elder_dc() {
  docker compose --env-file quickstart/.data/quickstart.env \
    -f quickstart/compose.yaml "$@"
}

python3 quickstart/run.py status
elder_dc ps
elder_dc port body-engine 8100
elder_dc exec -T body-db psql -U body -d body -Atc \
  "SELECT name FROM schema_migrations WHERE name = '850_japanese_language.sql';"
```

最后一条应输出 `850_japanese_language.sql`。从生成配置中只读取非敏感的端口信息：

```bash
grep -E '^W2W_(PROJECT|BODY_PORT|OW_PORT|SF_PORT|TZ)=' \
  quickstart/.data/quickstart.env
```

下面以默认端口为例，若被自动顺延或显式更改，替换成实际端口：

```bash
curl --fail --silent --show-error http://127.0.0.1:18100/healthz
curl --fail --silent --show-error --output /dev/null http://127.0.0.1:18100/app/
curl --fail --silent --show-error --output /dev/null http://127.0.0.1:18100/docs
curl --fail --silent --show-error http://127.0.0.1:18200/api/v1/health
elder_dc ps -q | xargs -r docker stats --no-stream
```

`/healthz` 应返回 `{"ok":true}`，此端点会查询数据库。还需检查服务没有持续重启、OOM 或迁移报错；SparkyFitness 前端应可在其实际端口打开。

这些检查需要已有 curl；缺少工具时可用主机 Python 的 urllib 完成同样的 HTTP 检查，不要为了一个检查擅自安装环境。Docker stats 是当前使用量，不能保证未来负载。

## 6. 登录与三语言验收

生成新的测试登录链接：

```bash
python3 quickstart/run.py login
```

链接中的 code 是一次性的，当前脚本生成的有效期为 24 小时。只在与项目拥有者的私密对话中交付，不贴到公开日志、Issue、PR 或截图中；不要发送数据库密码、API key 或长期 token。

必须在浏览器做以下检查：

1. 打开登录链接，看到合成示例数据，而不是把接口 200 当成页面已可用。
2. 在“我 → 个人资料 → 语言”切换中文、English、日本語，保存并刷新，确认选择被保留；日语的 `X-Body-Lang` 为 `ja`，主要导航为“今日 / 推移 / 記録 / 自分”。
3. 开启顶部“大字模式 / Easy view / 大きな文字”，确认大字、按钮和四项底部导航；可以恢复标准模式。
4. 朗读依赖**访问网页那台设备**的本地语音，不是 Grok 服务器的声卡；缺少本地语音时应提示，不能报成后端坏了。
5. 选日语时部分高级页面、服务端解释和同意书显示英文，这是当前实现范围；同意书必须如实记录实际英文文本语言。

演示账号本身不用于检验新用户的隐私同意流程。真实手表连接、推送和 AI 模型调用需要另行配置，不能在交付中写成已经完成。

## 7. 让我从自己的设备访问

默认 `127.0.0.1` 只代表 **Grok 那台机器自己**，不能把它直接当作用户的访问网址。不得为图方便把数据库、Redis、OW 或 SparkyFitness 直接暴露到公网。

如果已有可用 SSH 通道，用户可在自己的电脑上做本地端口转发。以下是模板，Grok 应给出实际主机、账号和后端端口；不要索要或公开私钥：

```bash
ssh -N -L 18100:127.0.0.1:18100 DEPLOY_USER@DEPLOY_HOST
```

建立后，用户访问自己电脑的 `http://localhost:18100/app/`；一次性登录链接使用用户端映射的 localhost 端口。若该端口已被占用，选择另一个用户端端口，并相应修改链接。

没有 SSH 时，先报告平台是否提供受控转发或已有私网入口。需要新增 Tailscale/公网隧道、登录外部账号、建立公开入口或修改防火墙时，先说明方案并取得用户授权。外部入口应使用 HTTPS 并保留应用鉴权；公网 HTTP IP 地址可能无法保持安全 Cookie 登录。

不要删除 `Secure` Cookie、CSRF 或鉴权来“解决”远程登录。Quick Start 的 `BODY_WEB_INSECURE_LOCAL_COOKIE=1` 只对 Host 为 localhost/回环地址的请求生效。

通过新的 HTTPS 域名访问时，还需要单独检查 `BODY_PUBLIC_URL`、重定向和 Cookie，以及部署环境的真实外部请求结果；Quick Start 默认的 localhost public URL 不可直接视为正式公网配置。真实 iPhone 健康数据同步还需要独立可达的同步服务地址与客户端配置。

如果环境不能提供任何可授权的外部入口，交付时明确标记“仅本机测试成功，用户远程访问未完成”，不要编造网址或宣称已上线。

## 8. 日志、重启、更新和数据

```bash
python3 quickstart/run.py status
python3 quickstart/run.py logs body-engine
python3 quickstart/run.py logs ow-app

# 重建/启动已有服务，沿用数据库和生成配置：
python3 quickstart/run.py up --tz Australia/Sydney

# 仅重启 API（需先定义第 5 节的 elder_dc）：
elder_dc restart body-engine

# 停止本项目容器，保留命名卷和 .data：
python3 quickstart/run.py down
```

- 日志可能含登录验证码或请求信息，发回前先脱敏；不要把 `.env` 或整个 secrets 文件夹贴出来。
- Docker 重启策略只在 daemon 和原数据仍在时有效。平台回收/替换机器、丢失磁盘或网络中断不能靠 restart 保证恢复，更没有 24/7 SLA。
- 私密状态在 `quickstart/.data/`，数据库和其他文件还在 Docker 命名卷；**只备份 Git 仓库或只复制 .data 都不完整**。
- 更新前备份 Body / OW / SparkyFitness 数据库、`.data` 中的密钥及相关持久卷（例如 SparkyFitness uploads），受限保存，确认可恢复。测试阶段如果没有完整备份，只能保留合成数据，不能接入真实健康信息。
- 工作区干净时可以 `git pull --ff-only origin feat/elder-care-mvp` 后重新运行 up。新迁移可能改变数据库；仅切回旧 Git commit 不等于数据库回滚，失败时先保留现场和备份。
- 不得自动执行 `quickstart ... reset`、`docker compose down -v`、`docker volume prune` 或 `docker system prune --volumes`。
- Quick Start 只在初始化时计算一批演示分数，没有建立生产定时任务/备份机制。正式运行需要另外完成部署与运维配置，参见 `docs/README.md` 的 Self-hosting 和 `deploy/ops/README.md`。

## 9. Grok Bot 最终验收回复模板

```text
部署状态：本机成功 / 外部访问成功 / 阻塞（不能混为一项）
代码：Fork URL、分支、实际 commit
机器：系统/架构、实测可用资源、磁盘是否持久、是否可能被回收
运行：Docker/Compose 版本、Compose 项目名、服务状态/重启情况
验证：healthz 返回、850 迁移记录、网页实测结果
功能：合成数据、中/英/日保存刷新、大字模式
访问：实际可用入口、访问前提、是否完成用户侧或授权外部检查
登录：一次性登录方式仅私密交付，不附长期密钥
运维：如何查看日志/重启/停止，数据目录与命名卷，备份与重启持久性状态
未完成：真实 HealthKit、AI、推送、生产运维等逐项如实列出
失败时：失败步骤、脱敏错误、是否保留现场、下一步需要的具体权限或信息
```

## 来源与验证范围

本说明依据当前分支的 `quickstart/run.py`、`quickstart/compose.yaml`、`body_engine/Dockerfile`、`web/session.py`、`db.py` 和 CLI 实现编写；Docker 安装兼容性参考上面的官方 Debian 文档。本轮只编写交接文档与检查命令，不代表已经在 Grok 的机器启动容器、验证镜像可拉取或完成远程访问。
