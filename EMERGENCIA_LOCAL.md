# Canal emergencial local para as TVs

Quando a Vercel ou o Supabase estiverem indisponíveis, o Roku V42 pode buscar
uma programação temporária diretamente no computador da fábrica pela rede local.
O player tenta o servidor principal primeiro e, em caso de erro, tenta os
endereços locais `192.168.0.122` e `192.168.0.159` na porta `8787`.

## Preparar imagens ou vídeo

1. Coloque arquivos PNG, JPG, WEBP ou MP4 em `emergency-media`.
2. Edite `emergency-media/playlist.json`:

```json
{
  "items": [
    { "file": "aviso.png", "title": "Aviso da fábrica", "duration": 20 },
    { "file": "video.mp4", "title": "Comunicado", "duration": 45, "type": "video" }
  ]
}
```

3. Inicie o servidor no computador conectado à mesma rede das TVs:

```powershell
npm.cmd run emergency:server
```

Se o computador estiver usando outro endereço, execute:

```powershell
$env:EMERGENCY_HOST = '192.168.0.xxx'
npm.cmd run emergency:server
```

Confirme no navegador do computador que
`http://192.168.0.xxx:8787/emergency.json` responde com JSON.

## Instalar o player

Instale `Central_Dashboard_TVs_Roku_V_42.zip` no Roku pela página de
desenvolvimento (`Install with zip`). Depois, abra o player na TV. Se a Central
estiver fora do ar, o Roku carrega automaticamente a playlist local. Quando o
servidor principal voltar, ele retoma a programação normal.

O servidor local deve permanecer aberto e o firewall do Windows precisa liberar
a porta TCP 8787 na rede privada. Esse canal não envia arquivos pela internet;
ele funciona somente dentro da rede local da fábrica.
