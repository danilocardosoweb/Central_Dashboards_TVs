sub init()
    m.top.functionName = "sendHeartbeat"
end sub

sub sendHeartbeat()
    m.top.error = ""
    m.top.statusCode = 0

    transfer = CreateObject("roUrlTransfer")
    port = CreateObject("roMessagePort")
    transfer.SetMessagePort(port)
    transfer.SetCertificatesFile("common:/certs/ca-bundle.crt")
    transfer.InitClientCertificates()
    transfer.RetainBodyOnError(true)
    transfer.SetUrl(m.top.endpoint)
    transfer.AddHeader("Accept", "application/json")
    transfer.AddHeader("Content-Type", "application/json; charset=utf-8")
    transfer.AddHeader("Cache-Control", "no-cache, no-store")

    if not transfer.AsyncPostFromString(FormatJson(m.top.payload))
        m.top.error = "Nao foi possivel iniciar o heartbeat."
        return
    end if

    event = Wait(10000, port)
    if event = invalid or Type(event) <> "roUrlEvent"
        transfer.AsyncCancel()
        m.top.error = "Tempo esgotado ao enviar o heartbeat."
        return
    end if

    statusCode = event.GetResponseCode()
    m.top.statusCode = statusCode
    responseText = event.GetString()
    if statusCode < 200 or statusCode >= 300
        m.top.error = "Heartbeat respondeu com erro " + statusCode.ToStr() + "."
        return
    end if

    parsed = ParseJson(responseText)
    if parsed = invalid then parsed = { ok: true }
    m.top.result = parsed
end sub
