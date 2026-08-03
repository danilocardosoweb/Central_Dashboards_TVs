sub init()
    m.top.functionName = "fetchState"
end sub

sub fetchState()
    m.top.error = ""
    m.top.traceId = ""
    m.top.statusCode = 0
    m.top.fromCache = false
    m.top.warning = ""

    transfer = CreateObject("roUrlTransfer")
    port = CreateObject("roMessagePort")
    transfer.SetMessagePort(port)
    transfer.SetCertificatesFile("common:/certs/ca-bundle.crt")
    transfer.InitClientCertificates()
    transfer.RetainBodyOnError(true)

    separator = "?"
    if Instr(1, m.top.endpoint, "?") > 0 then separator = "&"
    now = CreateObject("roDateTime")
    transfer.SetUrl(m.top.endpoint + separator + "t=" + now.AsSeconds().ToStr())
    transfer.AddHeader("Accept", "application/json")
    transfer.AddHeader("Cache-Control", "no-cache, no-store")
    transfer.AddHeader("Pragma", "no-cache")

    if not transfer.AsyncGetToString()
        useCachedState("Nao foi possivel iniciar a consulta da Central.")
        return
    end if

    event = Wait(15000, port)
    if event = invalid or Type(event) <> "roUrlEvent"
        transfer.AsyncCancel()
        useCachedState("Tempo esgotado ao consultar a Central.")
        return
    end if

    statusCode = event.GetResponseCode()
    m.top.statusCode = statusCode
    response = event.GetString()
    if response = invalid or response = ""
        useCachedState("A base central nao respondeu.")
        return
    end if

    parsed = ParseJson(response)
    if parsed = invalid
        useCachedState("A base central retornou dados invalidos.")
        return
    end if

    if GetInterface(parsed, "ifAssociativeArray") <> invalid
        if parsed.DoesExist("traceId") and parsed.traceId <> invalid
            m.top.traceId = parsed.traceId.ToStr()
        end if
    end if

    if statusCode < 200 or statusCode >= 300
        message = "A base central respondeu com erro " + statusCode.ToStr() + "."
        if GetInterface(parsed, "ifAssociativeArray") <> invalid
            if parsed.DoesExist("error") and parsed.error <> invalid
                message = parsed.error
            else if parsed.DoesExist("message") and parsed.message <> invalid
                message = parsed.message
            end if
        end if
        useCachedState(message)
        return
    end if

    row = extractStateRow(parsed)
    if row = invalid
        useCachedState("A configuracao recebida nao pode ser lida.")
        return
    end if

    WriteAsciiFile("cachefs:/central-dashboard-state.json", FormatJson(row))
    m.top.result = row
end sub

function extractStateRow(parsed as dynamic) as dynamic
    row = parsed
    if GetInterface(parsed, "ifArray") <> invalid
        if parsed.Count() = 0 then return invalid
        row = parsed[0]
    else if GetInterface(parsed, "ifAssociativeArray") <> invalid
        if parsed.DoesExist("row") and parsed.row <> invalid then row = parsed.row
    end if

    if row = invalid or GetInterface(row, "ifAssociativeArray") = invalid then return invalid
    if not row.DoesExist("payload") or row.payload = invalid then return invalid
    return row
end function

sub useCachedState(message as string)
    cachedText = ReadAsciiFile("cachefs:/central-dashboard-state.json")
    if cachedText <> invalid and cachedText <> ""
        cachedRow = ParseJson(cachedText)
        if extractStateRow(cachedRow) <> invalid
            m.top.fromCache = true
            m.top.warning = message
            m.top.result = cachedRow
            return
        end if
    end if
    m.top.error = message
end sub
