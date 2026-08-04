sub init()
    m.top.functionName = "sendEvent"
end sub

sub sendEvent()
    m.top.error = ""
    m.top.statusCode = 0
    if m.top.endpoint = "" or m.top.eventPayload = invalid then return

    transfer = CreateObject("roUrlTransfer")
    port = CreateObject("roMessagePort")
    transfer.SetMessagePort(port)
    transfer.SetCertificatesFile("common:/certs/ca-bundle.crt")
    transfer.InitClientCertificates()
    transfer.RetainBodyOnError(true)
    transfer.SetUrl(m.top.endpoint)
    transfer.AddHeader("Content-Type", "application/json")
    transfer.AddHeader("Accept", "application/json")
    body = FormatJson({ action: "alert-event", event: m.top.eventPayload })

    if not transfer.AsyncPostFromString(body)
        m.top.error = "Nao foi possivel iniciar o registro do alerta."
        return
    end if

    event = Wait(8000, port)
    if event = invalid or Type(event) <> "roUrlEvent"
        transfer.AsyncCancel()
        m.top.error = "Tempo esgotado ao registrar o alerta."
        return
    end if
    m.top.statusCode = event.GetResponseCode()
    if m.top.statusCode < 200 or m.top.statusCode >= 300
        m.top.error = "Falha ao registrar o alerta: " + m.top.statusCode.ToStr()
    end if
end sub
