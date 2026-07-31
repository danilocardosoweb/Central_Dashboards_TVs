sub init()
    m.endpoint = "https://ypwpumtzbdraldccctfd.supabase.co/rest/v1/tv_app_state?select=id,payload,revision,updated_at&id=eq.central&limit=1"
    m.apiKey = "sb_publishable_rtGvHhP6FGA4snm_aDDUgA_vZWnEhFv"

    m.canvas = m.top.FindNode("canvas")
    m.contentGroup = m.top.FindNode("contentGroup")
    m.dashboardImage = m.top.FindNode("dashboardImage")
    m.messagePanel = m.top.FindNode("messagePanel")
    m.accent = m.top.FindNode("accent")
    m.kicker = m.top.FindNode("kicker")
    m.headline = m.top.FindNode("headline")
    m.body = m.top.FindNode("body")
    m.action = m.top.FindNode("action")
    m.actionBackground = m.top.FindNode("actionBackground")
    m.meta = m.top.FindNode("meta")
    m.bannerGroup = m.top.FindNode("bannerGroup")
    m.bannerBackground = m.top.FindNode("bannerBackground")
    m.bannerTitle = m.top.FindNode("bannerTitle")
    m.bannerBody = m.top.FindNode("bannerBody")
    m.stationLabel = m.top.FindNode("stationLabel")
    m.syncLabel = m.top.FindNode("syncLabel")
    m.stationOverlay = m.top.FindNode("stationOverlay")
    m.stationList = m.top.FindNode("stationList")
    m.loading = m.top.FindNode("loading")
    m.slideTimer = m.top.FindNode("slideTimer")
    m.syncTimer = m.top.FindNode("syncTimer")
    m.fadeIn = m.top.FindNode("fadeIn")

    m.slideTimer.ObserveField("fire", "onSlideTimer")
    m.syncTimer.ObserveField("fire", "onSyncTimer")
    m.stationList.ObserveField("itemSelected", "onStationSelected")

    m.state = invalid
    m.stations = []
    m.slides = []
    m.slideIndex = -1
    m.lastRevision = -1
    m.fetching = false
    m.paused = false
    m.defaultDuration = 30

    applyResolutionScale()
    showLoading("Conectando à Central...")
    fetchCentralState()
    m.syncTimer.control = "start"
end sub

sub applyResolutionScale()
    deviceInfo = CreateObject("roDeviceInfo")
    resolution = deviceInfo.GetUIResolution()
    width = 1920
    height = 1080
    if resolution <> invalid
        if resolution.DoesExist("width") then width = resolution.width
        if resolution.DoesExist("height") then height = resolution.height
    end if
    m.canvas.scale = [width / 1920.0, height / 1080.0]
end sub

sub fetchCentralState()
    if m.fetching then return
    m.fetching = true

    task = CreateObject("roSGNode", "FetchStateTask")
    task.endpoint = m.endpoint
    task.apiKey = m.apiKey
    task.ObserveField("result", "onFetchResult")
    task.ObserveField("error", "onFetchError")
    m.fetchTask = task
    task.control = "run"
end sub

sub onFetchResult()
    row = m.fetchTask.result
    m.fetching = false
    if row = invalid then return

    revision = valueOr(row, "revision", 0)
    m.syncLabel.text = "Sincronizado " + currentClock()
    m.loading.control = "stop"
    m.loading.visible = false

    if revision = m.lastRevision and m.state <> invalid
        return
    end if

    payload = valueOr(row, "payload", invalid)
    if payload = invalid
        showError("A configuração central está vazia.")
        return
    end if

    m.lastRevision = revision
    m.state = payload
    m.stations = arrayOrEmpty(valueOr(payload, "stations", []))
    configureDefaultDuration(payload)
    chooseOrRestoreStation()
end sub

sub onFetchError()
    errorMessage = m.fetchTask.error
    if errorMessage = "" then return
    m.fetching = false
    m.syncLabel.text = "Sem sincronização • nova tentativa em 10s"
    m.loading.control = "stop"
    m.loading.visible = false

    if m.state = invalid
        showError(errorMessage)
    end if
end sub

sub configureDefaultDuration(payload as object)
    settings = valueOr(payload, "settings", invalid)
    if settings = invalid then return
    transitionTime = valueOr(settings, "transitionTime", 30000)
    seconds = Int(transitionTime / 1000)
    if seconds < 5 then seconds = 5
    m.defaultDuration = seconds
end sub

sub chooseOrRestoreStation()
    if m.stations.Count() = 0
        m.stations.Push({
            id: "station-default"
            name: "Esta TV"
            areaId: "geral"
        })
    end if

    savedId = readRegistryValue("stationId")
    index = findStationIndex(savedId)

    if index >= 0
        activateStation(index)
    else if m.stations.Count() = 1
        activateStation(0)
    else
        showStationSelector()
    end if
end sub

sub showStationSelector()
    content = CreateObject("roSGNode", "ContentNode")
    for each station in m.stations
        item = content.CreateChild("ContentNode")
        item.title = valueOr(station, "name", "TV") + "  •  " + getAreaName(valueOr(station, "areaId", "geral"))
    end for

    m.stationList.content = content
    currentIndex = findStationIndex(readRegistryValue("stationId"))
    if currentIndex < 0 then currentIndex = 0
    m.stationList.jumpToItem = currentIndex
    m.stationOverlay.visible = true
    m.stationList.SetFocus(true)
    m.slideTimer.control = "stop"
end sub

sub hideStationSelector()
    m.stationOverlay.visible = false
    m.top.SetFocus(true)
end sub

sub onStationSelected()
    index = m.stationList.itemSelected
    if index < 0 or index >= m.stations.Count() then return
    activateStation(index)
end sub

sub activateStation(index as integer)
    station = m.stations[index]
    m.currentStation = station
    writeRegistryValue("stationId", valueOr(station, "id", "station-default"))
    hideStationSelector()
    buildPlaylist()
end sub

sub buildPlaylist()
    if m.state = invalid or m.currentStation = invalid then return

    areaId = valueOr(m.currentStation, "areaId", "geral")
    urls = arrayOrEmpty(valueOr(m.state, "urls", []))
    alerts = arrayOrEmpty(valueOr(m.state, "alerts", []))
    m.slides = []

    for each dashboard in urls
        if belongsToArea(dashboard, areaId)
            m.slides.Push({
                kind: "dashboard"
                title: valueOr(dashboard, "name", "Dashboard")
                body: "Conteúdo cadastrado na Central Web."
                imageUrl: dashboardImageUrl(dashboard)
                duration: m.defaultDuration
            })
        end if
    end for

    banner = invalid
    for each alert in alerts
        if isAlertActive(alert) and belongsToArea(alert, areaId)
            mode = LCase(valueOr(alert, "displayMode", "fullscreen"))
            if mode = "banner"
                if banner = invalid then banner = alert
            else
                m.slides.Push({
                    kind: "alert"
                    source: alert
                    title: valueOr(alert, "title", "Comunicado")
                    body: valueOr(alert, "body", "")
                    imageUrl: remoteAlertImage(alert)
                    duration: valueOr(alert, "duration", 20)
                })
            end if
        end if
    end for

    renderBanner(banner)
    stationName = valueOr(m.currentStation, "name", "Esta TV")
    m.stationLabel.text = stationName + "  •  " + getAreaName(areaId)

    m.slideIndex = -1
    if m.slides.Count() = 0
        showEmptyState()
    else
        showNextSlide()
    end if
end sub

sub showNextSlide()
    if m.slides.Count() = 0 then return
    m.slideIndex = (m.slideIndex + 1) mod m.slides.Count()
    renderSlide(m.slides[m.slideIndex])
end sub

sub showPreviousSlide()
    if m.slides.Count() = 0 then return
    m.slideIndex = m.slideIndex - 1
    if m.slideIndex < 0 then m.slideIndex = m.slides.Count() - 1
    renderSlide(m.slides[m.slideIndex])
end sub

sub renderSlide(slide as object)
    m.slideTimer.control = "stop"
    imageUrl = valueOr(slide, "imageUrl", "")

    if imageUrl <> ""
        m.dashboardImage.uri = imageUrl
        m.dashboardImage.visible = true
        m.messagePanel.visible = false
    else
        m.dashboardImage.visible = false
        m.messagePanel.visible = true

        if slide.kind = "alert"
            renderAlertSlide(slide)
        else
            renderDashboardPlaceholder(slide)
        end if
    end if

    m.contentGroup.opacity = 0.0
    m.fadeIn.control = "start"
    updateSlideStatus()

    duration = valueOr(slide, "duration", m.defaultDuration)
    if duration < 5 then duration = 5
    m.slideTimer.duration = duration
    if not m.paused then m.slideTimer.control = "start"
end sub

sub renderDashboardPlaceholder(slide as object)
    m.accent.color = "0x3B82F6FF"
    m.kicker.color = "0x60A5FAFF"
    m.kicker.text = "DASHBOARD • PLAYER ROKU"
    m.headline.text = valueOr(slide, "title", "Dashboard")
    m.body.text = "Este dashboard já chegou ao Roku, mas ainda não possui uma imagem vinculada."
    m.action.text = "Na Central Web, use o botão de TV e informe um link HTTPS de imagem PNG, JPEG ou WebP."
    m.actionBackground.visible = true
    m.meta.text = "O link do Power BI continua sendo exibido normalmente no player para navegador."
end sub

sub renderAlertSlide(slide as object)
    alert = valueOr(slide, "source", {})
    category = valueOr(alert, "category", "info")
    color = categoryColor(category)
    m.accent.color = color
    m.kicker.color = color
    m.kicker.text = UCase(categoryLabel(category))
    m.headline.text = valueOr(alert, "title", "Comunicado")
    m.body.text = valueOr(alert, "body", "")

    actionText = valueOr(alert, "action", "")
    if actionText = ""
        m.actionBackground.visible = false
        m.action.text = ""
    else
        m.actionBackground.visible = true
        m.action.text = "Ação: " + actionText
    end if

    audience = valueOr(alert, "audience", "")
    owner = valueOr(alert, "owner", "")
    metaText = ""
    if audience <> "" then metaText = "Público: " + audience
    if owner <> ""
        if metaText <> "" then metaText = metaText + "    "
        metaText = metaText + "Responsável: " + owner
    end if
    m.meta.text = metaText
end sub

sub renderBanner(alert as dynamic)
    if alert = invalid
        m.bannerGroup.visible = false
        return
    end if

    category = valueOr(alert, "category", "info")
    m.bannerBackground.color = categoryColor(category)
    m.bannerTitle.text = UCase(categoryLabel(category))
    title = valueOr(alert, "title", "Comunicado")
    bodyText = valueOr(alert, "body", "")
    if bodyText <> "" then title = title + " • " + bodyText
    m.bannerBody.text = title
    m.bannerGroup.visible = true
end sub

sub showLoading(message as string)
    m.loading.visible = true
    m.loading.control = "start"
    m.stationLabel.text = "Central Dashboards TVs"
    m.syncLabel.text = message
end sub

sub showError(message as string)
    m.dashboardImage.visible = false
    m.messagePanel.visible = true
    m.accent.color = "0xEF4444FF"
    m.kicker.color = "0xF87171FF"
    m.kicker.text = "SEM CONEXÃO"
    m.headline.text = "Não foi possível carregar a programação"
    m.body.text = message
    m.actionBackground.visible = true
    m.action.text = "Verifique a internet. O aplicativo tentará novamente automaticamente."
    m.meta.text = "Pressione * para escolher outra estação quando a base voltar."
end sub

sub showEmptyState()
    m.dashboardImage.visible = false
    m.messagePanel.visible = true
    m.accent.color = "0x64748BFF"
    m.kicker.color = "0x94A3B8FF"
    m.kicker.text = "PROGRAMAÇÃO VAZIA"
    m.headline.text = "Nenhum conteúdo para esta TV"
    m.body.text = "Cadastre dashboards ou avisos para a área selecionada usando a Central Web."
    m.actionBackground.visible = false
    m.action.text = ""
    m.meta.text = "A programação será atualizada automaticamente."
    m.slideTimer.control = "stop"
end sub

sub updateSlideStatus()
    stateText = "reproduzindo"
    if m.paused then stateText = "pausado"
    m.syncLabel.text = (m.slideIndex + 1).ToStr() + " de " + m.slides.Count().ToStr() + " • " + stateText + " • " + currentClock()
end sub

sub onSlideTimer()
    showNextSlide()
end sub

sub onSyncTimer()
    fetchCentralState()
end sub

function onKeyEvent(key as string, press as boolean) as boolean
    if not press then return false

    if m.stationOverlay.visible
        if key = "back"
            if m.currentStation <> invalid
                hideStationSelector()
                return true
            end if
        end if
        return false
    end if

    if key = "options"
        showStationSelector()
        return true
    else if key = "right"
        showNextSlide()
        return true
    else if key = "left"
        showPreviousSlide()
        return true
    else if key = "OK" or key = "play"
        m.paused = not m.paused
        if m.paused
            m.slideTimer.control = "stop"
        else if m.slides.Count() > 0
            m.slideTimer.control = "start"
        end if
        updateSlideStatus()
        return true
    end if

    return false
end function

function valueOr(item as dynamic, key as string, fallback as dynamic) as dynamic
    if item <> invalid and GetInterface(item, "ifAssociativeArray") <> invalid
        if item.DoesExist(key) and item[key] <> invalid
            return item[key]
        end if
    end if
    return fallback
end function

function arrayOrEmpty(value as dynamic) as object
    if value <> invalid and GetInterface(value, "ifArray") <> invalid
        return value
    end if
    return []
end function

function belongsToArea(item as dynamic, areaId as string) as boolean
    if areaId = "__all__" then return true
    areaIds = arrayOrEmpty(valueOr(item, "areaIds", []))
    if areaIds.Count() = 0 then return areaId = "geral"
    for each itemArea in areaIds
        if itemArea = "*" or itemArea = areaId then return true
    end for
    return false
end function

function dashboardImageUrl(dashboard as dynamic) as string
    keys = ["rokuImageUrl", "snapshotUrl", "imageUrl", "rokuImage"]
    for each key in keys
        candidate = valueOr(dashboard, key, "")
        if Left(LCase(candidate), 8) = "https://" then return candidate
    end for
    return ""
end function

function remoteAlertImage(alert as dynamic) as string
    candidate = valueOr(alert, "rokuImageUrl", "")
    if Left(LCase(candidate), 8) = "https://" then return candidate
    candidate = valueOr(alert, "imageUrl", "")
    if Left(LCase(candidate), 8) = "https://" then return candidate
    return ""
end function

function isAlertActive(alert as dynamic) as boolean
    if not valueOr(alert, "enabled", true) then return false

    nowValue = CreateObject("roDateTime").AsSeconds()
    startValue = dateSeconds(valueOr(alert, "start", ""))
    endValue = dateSeconds(valueOr(alert, "end", ""))
    if startValue > 0 and nowValue < startValue then return false
    if endValue > 0 and nowValue > endValue then return false
    return true
end function

function dateSeconds(value as string) as integer
    if value = "" then return 0
    date = CreateObject("roDateTime")
    date.FromISO8601String(value)
    return date.AsSeconds()
end function

function getAreaName(areaId as string) as string
    if areaId = "__all__" then return "Programação completa"
    if m.state = invalid then return "Geral"
    areas = arrayOrEmpty(valueOr(m.state, "areas", []))
    for each area in areas
        if valueOr(area, "id", "") = areaId
            return valueOr(area, "name", "Geral")
        end if
    end for
    return "Geral"
end function

function findStationIndex(stationId as string) as integer
    if stationId = "" then return -1
    for index = 0 to m.stations.Count() - 1
        if valueOr(m.stations[index], "id", "") = stationId then return index
    end for
    return -1
end function

function categoryLabel(category as string) as string
    labels = {
        quality: "Qualidade"
        safety: "Segurança"
        maintenance: "Manutenção"
        recognition: "Reconhecimento"
        info: "Comunicado"
    }
    if labels.DoesExist(category) then return labels[category]
    return "Comunicado"
end function

function categoryColor(category as string) as string
    colors = {
        quality: "0xEA580CFF"
        safety: "0xDC2626FF"
        maintenance: "0xD97706FF"
        recognition: "0x16A34AFF"
        info: "0x2563EBFF"
    }
    if colors.DoesExist(category) then return colors[category]
    return colors.info
end function

function currentClock() as string
    date = CreateObject("roDateTime")
    date.ToLocalTime()
    return pad2(date.GetHours()) + ":" + pad2(date.GetMinutes())
end function

function pad2(value as integer) as string
    text = value.ToStr()
    if value < 10 then text = "0" + text
    return text
end function

function readRegistryValue(key as string) as string
    section = CreateObject("roRegistrySection", "CentralDashboardsTVs")
    if section.Exists(key) then return section.Read(key)
    return ""
end function

sub writeRegistryValue(key as string, value as string)
    section = CreateObject("roRegistrySection", "CentralDashboardsTVs")
    section.Write(key, value)
    section.Flush()
end sub
