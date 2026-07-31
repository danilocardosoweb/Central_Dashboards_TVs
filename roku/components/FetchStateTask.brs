sub init()
    m.top.functionName = "fetchState"
end sub

sub fetchState()
    m.top.error = ""

    transfer = CreateObject("roUrlTransfer")
    transfer.SetCertificatesFile("common:/certs/ca-bundle.crt")
    transfer.InitClientCertificates()
    transfer.SetUrl(m.top.endpoint)
    transfer.AddHeader("apikey", m.top.apiKey)
    transfer.AddHeader("Authorization", "Bearer " + m.top.apiKey)
    transfer.AddHeader("Accept", "application/json")

    response = transfer.GetToString()
    if response = invalid or response = ""
        m.top.error = "A base central não respondeu."
        return
    end if

    parsed = ParseJson(response)
    if parsed = invalid
        m.top.error = "A base central retornou dados inválidos."
        return
    end if

    if GetInterface(parsed, "ifArray") = invalid or parsed.Count() = 0
        m.top.error = "A configuração central ainda está vazia."
        return
    end if

    row = parsed[0]
    if row = invalid or GetInterface(row, "ifAssociativeArray") = invalid
        m.top.error = "A configuração recebida não pôde ser lida."
        return
    end if

    m.top.result = row
end sub
