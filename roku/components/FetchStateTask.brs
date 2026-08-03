sub init()
    m.top.functionName = "fetchState"
end sub

sub fetchState()
    m.top.error = ""

    transfer = CreateObject("roUrlTransfer")
    transfer.SetCertificatesFile("common:/certs/ca-bundle.crt")
    transfer.InitClientCertificates()
    separator = "?"
    if Instr(1, m.top.endpoint, "?") > 0 then separator = "&"
    now = CreateObject("roDateTime")
    transfer.SetUrl(m.top.endpoint + separator + "t=" + now.AsSeconds().ToStr())
    transfer.AddHeader("Accept", "application/json")
    transfer.AddHeader("Cache-Control", "no-cache, no-store")
    transfer.AddHeader("Pragma", "no-cache")

    response = transfer.GetToString()
    statusCode = transfer.GetResponseCode()
    if response = invalid or response = ""
        m.top.error = "A base central nao respondeu."
        return
    end if

    parsed = ParseJson(response)
    if parsed = invalid
        m.top.error = "A base central retornou dados invalidos."
        return
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
        m.top.error = message
        return
    end if

    row = parsed
    if GetInterface(parsed, "ifArray") <> invalid
        if parsed.Count() = 0
            m.top.error = "A configuracao central ainda esta vazia."
            return
        end if
        row = parsed[0]
    else if GetInterface(parsed, "ifAssociativeArray") <> invalid
        if parsed.DoesExist("row") and parsed.row <> invalid then row = parsed.row
    end if

    if row = invalid or GetInterface(row, "ifAssociativeArray") = invalid
        m.top.error = "A configuracao recebida nao pode ser lida."
        return
    end if

    m.top.result = row
end sub
