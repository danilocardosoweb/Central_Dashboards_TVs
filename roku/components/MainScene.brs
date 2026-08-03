sub init()
    m.endpoint = "https://central-dashboards-t-vs.vercel.app/api/state"

    m.canvas = m.top.FindNode("canvas")
    m.contentGroup = m.top.FindNode("contentGroup")
    m.dashboardImageA = m.top.FindNode("dashboardImageA")
    m.dashboardImageB = m.top.FindNode("dashboardImageB")
    m.messagePanel = m.top.FindNode("messagePanel")
    m.accent = m.top.FindNode("accent")
    m.kicker = m.top.FindNode("kicker")
    m.headline = m.top.FindNode("headline")
    m.body = m.top.FindNode("body")
    m.action = m.top.FindNode("action")
    m.actionBackground = m.top.FindNode("actionBackground")
    m.meta = m.top.FindNode("meta")
    m.pprPanel = m.top.FindNode("pprPanel")
    m.pprBackground = m.top.FindNode("pprBackground")
    m.pprHeaderLine = m.top.FindNode("pprHeaderLine")
    m.pprPeriodBackground = m.top.FindNode("pprPeriodBackground")
    m.pprGaugeCard = m.top.FindNode("pprGaugeCard")
    m.pprContentCard = m.top.FindNode("pprContentCard")
    m.pprKicker = m.top.FindNode("pprKicker")
    m.pprTitle = m.top.FindNode("pprTitle")
    m.pprThermometerGroup = m.top.FindNode("pprThermometerGroup")
    m.pprThermometerTrack = m.top.FindNode("pprThermometerTrack")
    m.pprThermometerFill = m.top.FindNode("pprThermometerFill")
    m.pprBulb = m.top.FindNode("pprBulb")
    m.pprBulbTrack = m.top.FindNode("pprBulbTrack")
    m.pprPeriod = m.top.FindNode("pprPeriod")
    m.pprValueCaption = m.top.FindNode("pprValueCaption")
    m.pprValue = m.top.FindNode("pprValue")
    m.pprGoalContext = m.top.FindNode("pprGoalContext")
    m.pprName = m.top.FindNode("pprName")
    m.pprDescription = m.top.FindNode("pprDescription")
    m.pprStatusBackground = m.top.FindNode("pprStatusBackground")
    m.pprStatus = m.top.FindNode("pprStatus")
    m.pprDetails = m.top.FindNode("pprDetails")
    m.pprProgressTrack = m.top.FindNode("pprProgressTrack")
    m.pprProgressFill = m.top.FindNode("pprProgressFill")
    m.pprSummaryGroup = m.top.FindNode("pprSummaryGroup")
    m.pprSummaryScoreCard = m.top.FindNode("pprSummaryScoreCard")
    m.pprSummaryTotalCard = m.top.FindNode("pprSummaryTotalCard")
    m.pprSummaryReachedCard = m.top.FindNode("pprSummaryReachedCard")
    m.pprSummaryAttentionCard = m.top.FindNode("pprSummaryAttentionCard")
    m.pprSummaryListCard = m.top.FindNode("pprSummaryListCard")
    m.pprSummaryAverage = m.top.FindNode("pprSummaryAverage")
    m.pprSummaryTotal = m.top.FindNode("pprSummaryTotal")
    m.pprSummaryReached = m.top.FindNode("pprSummaryReached")
    m.pprSummaryAttention = m.top.FindNode("pprSummaryAttention")
    m.pprSummaryList = m.top.FindNode("pprSummaryList")
    m.pprScale150 = m.top.FindNode("pprScale150")
    m.pprScale125 = m.top.FindNode("pprScale125")
    m.pprScale100 = m.top.FindNode("pprScale100")
    m.pprScale75 = m.top.FindNode("pprScale75")
    m.pprScale50 = m.top.FindNode("pprScale50")
    m.pprScale0 = m.top.FindNode("pprScale0")
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
    m.transitionTimer = m.top.FindNode("transitionTimer")
    m.imageLoadTimer = m.top.FindNode("imageLoadTimer")
    m.introGroup = m.top.FindNode("introGroup")
    m.introVideo = m.top.FindNode("introVideo")
    m.introFallbackTimer = m.top.FindNode("introFallbackTimer")
    m.fadeIn = m.top.FindNode("fadeIn")
    m.imageEnter = m.top.FindNode("imageEnter")
    m.imageEnterOpacity = m.top.FindNode("imageEnterOpacity")
    m.imageEnterTranslation = m.top.FindNode("imageEnterTranslation")
    m.imageEnterScale = m.top.FindNode("imageEnterScale")

    m.slideTimer.ObserveField("fire", "onSlideTimer")
    m.syncTimer.ObserveField("fire", "onSyncTimer")
    m.transitionTimer.ObserveField("fire", "onTransitionTimer")
    m.imageLoadTimer.ObserveField("fire", "onImageLoadTimer")
    m.introVideo.ObserveField("state", "onIntroVideoState")
    m.introFallbackTimer.ObserveField("fire", "onIntroFallbackTimer")
    m.dashboardImageA.ObserveField("loadStatus", "onImageALoadStatus")
    m.dashboardImageB.ObserveField("loadStatus", "onImageBLoadStatus")
    m.stationList.ObserveField("itemSelected", "onStationSelected")

    m.state = invalid
    m.stations = []
    m.stationChoices = []
    m.bannerAlerts = []
    m.slides = []
    m.slideIndex = -1
    m.lastRevision = -1
    m.lastUpdatedAt = ""
    m.fetching = false
    m.paused = false
    m.defaultDuration = 30
    m.transitionEffect = "fade"
    m.transitionDuration = 1.4
    m.currentImageName = ""
    m.pendingImageName = ""
    m.pendingImageUri = ""
    m.pendingSlide = invalid
    m.introPlaying = false
    m.preservePlaybackOnBuild = false

    applyResolutionScale()
    startIntroVideo()
    showLoading("Conectando à Central...")
    fetchCentralState()
    m.syncTimer.control = "start"
end sub

sub startIntroVideo()
    content = CreateObject("roSGNode", "ContentNode")
    content.url = "pkg:/videos/intro.mp4"
    content.streamFormat = "mp4"
    m.introVideo.visible = true
    m.introVideo.content = content
    m.introGroup.visible = true
    m.introPlaying = true
    m.introFallbackTimer.control = "start"
    m.introVideo.control = "play"
end sub

sub onIntroVideoState()
    state = m.introVideo.state
    if state = "finished" or state = "error" or state = "stopped"
        finishIntroVideo()
    end if
end sub

sub onIntroFallbackTimer()
    finishIntroVideo()
end sub

sub finishIntroVideo()
    if not m.introPlaying then return
    m.introPlaying = false
    m.introFallbackTimer.control = "stop"
    m.introVideo.control = "stop"
    m.introVideo.visible = false
    m.introVideo.content = invalid
    m.introGroup.visible = false

    if m.stationOverlay.visible
        m.stationList.SetFocus(true)
    else
        m.top.SetFocus(true)
    end if
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
    updatedAt = valueOr(row, "updated_at", "")
    m.syncLabel.text = "Sincronizado " + currentClock()
    m.loading.control = "stop"
    m.loading.visible = false

    if revision = m.lastRevision and updatedAt = m.lastUpdatedAt and m.state <> invalid
        return
    end if

    payload = valueOr(row, "payload", invalid)
    if payload = invalid
        showError("A configuração central está vazia.")
        return
    end if

    m.preservePlaybackOnBuild = m.state <> invalid
    m.lastRevision = revision
    m.lastUpdatedAt = updatedAt
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

    m.transitionEffect = LCase(valueOr(settings, "transitionEffect", "fade"))
    transitionDurationMs = valueOr(settings, "transitionDuration", 1400)
    m.transitionDuration = transitionDurationMs / 1000.0
    if m.transitionDuration < 0.3 then m.transitionDuration = 0.3
    if m.transitionDuration > 4.0 then m.transitionDuration = 4.0
end sub

sub chooseOrRestoreStation()
    if m.stations.Count() = 0
        m.stations.Push({
            id: "station-default"
            name: "Esta TV"
            areaId: "geral"
        })
    end if

    buildStationChoices()
    savedId = readRegistryValue("selectionId")
    if savedId = "" then savedId = readRegistryValue("stationId")
    index = findStationChoiceIndex(savedId)

    if index >= 0
        activateStationChoice(index)
    else if m.stationChoices.Count() = 1
        activateStationChoice(0)
    else
        showStationSelector()
    end if
end sub

sub buildStationChoices()
    m.stationChoices = []
    representedAreas = {}

    for each station in m.stations
        areaId = valueOr(station, "areaId", "geral")
        m.stationChoices.Push({
            id: valueOr(station, "id", "station-default")
            name: valueOr(station, "name", "TV")
            areaId: areaId
            kind: "station"
        })
        representedAreas[areaId] = true
    end for

    areas = arrayOrEmpty(valueOr(m.state, "areas", []))
    for each area in areas
        areaId = valueOr(area, "id", "")
        if areaId <> "" and not representedAreas.DoesExist(areaId)
            areaName = valueOr(area, "name", "Geral")
            m.stationChoices.Push({
                id: "area-" + areaId
                name: "Setor " + areaName
                areaId: areaId
                kind: "area"
            })
        end if
    end for
end sub

sub showStationSelector()
    content = CreateObject("roSGNode", "ContentNode")
    for each station in m.stationChoices
        item = content.CreateChild("ContentNode")
        item.title = valueOr(station, "name", "TV") + "  •  " + getAreaName(valueOr(station, "areaId", "geral"))
    end for

    m.stationList.content = content
    currentIndex = findStationChoiceIndex(readRegistryValue("selectionId"))
    if currentIndex < 0 then currentIndex = findStationChoiceIndex(readRegistryValue("stationId"))
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
    if index < 0 or index >= m.stationChoices.Count() then return
    activateStationChoice(index)
end sub

sub activateStationChoice(index as integer)
    station = m.stationChoices[index]
    m.currentStation = station
    selectionId = valueOr(station, "id", "station-default")
    writeRegistryValue("selectionId", selectionId)
    if valueOr(station, "kind", "station") = "station"
        writeRegistryValue("stationId", selectionId)
    end if
    hideStationSelector()
    buildPlaylist()
end sub

sub buildPlaylist()
    if m.state = invalid or m.currentStation = invalid then return

    previousSlide = invalid
    previousSlideSignature = ""
    preservePlayback = m.preservePlaybackOnBuild
    m.preservePlaybackOnBuild = false
    if preservePlayback and m.slideIndex >= 0 and m.slideIndex < m.slides.Count()
        previousSlide = m.slides[m.slideIndex]
        previousSlideSignature = FormatJson(previousSlide)
    end if

    areaId = valueOr(m.currentStation, "areaId", "geral")
    urls = arrayOrEmpty(valueOr(m.state, "urls", []))
    alerts = arrayOrEmpty(valueOr(m.state, "alerts", []))
    dashboardSlides = []
    alertSlides = []
    bannerAlerts = []
    pprSlides = []

    for each dashboard in urls
        if belongsToArea(dashboard, areaId)
            dashboardSlides.Push({
                id: valueOr(dashboard, "id", "")
                kind: "dashboard"
                title: valueOr(dashboard, "name", "Dashboard")
                body: "Conteúdo cadastrado na Central Web."
                imageUrl: dashboardImageUrl(dashboard)
                duration: m.defaultDuration
            })
        end if
    end for

    for each alert in alerts
        if isAlertActive(alert) and belongsToArea(alert, areaId)
            mode = LCase(valueOr(alert, "displayMode", "fullscreen"))
            if mode = "banner"
                bannerAlerts.Push(alert)
            else
                alertSlides.Push({
                    id: valueOr(alert, "id", "")
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

    ppr = valueOr(m.state, "ppr", invalid)
    if pprTargetsStation(ppr, m.currentStation, areaId)
        pprSlides = buildPprSlides(ppr)
    end if

    m.slides = []
    m.bannerAlerts = bannerAlerts
    pprPosition = LCase(valueOr(ppr, "sequencePosition", "after-dashboards"))
    if pprPosition = "start"
        appendSlides(m.slides, pprSlides)
        appendSlides(m.slides, dashboardSlides)
        appendSlides(m.slides, alertSlides)
    else if pprPosition = "end"
        appendSlides(m.slides, dashboardSlides)
        appendSlides(m.slides, alertSlides)
        appendSlides(m.slides, pprSlides)
    else
        appendSlides(m.slides, dashboardSlides)
        appendSlides(m.slides, pprSlides)
        appendSlides(m.slides, alertSlides)
    end if

    stationName = valueOr(m.currentStation, "name", "Esta TV")
    m.stationLabel.text = stationName + "  •  " + getAreaName(areaId)

    preservedIndex = findSlideIndex(m.slides, previousSlide)
    if preservedIndex >= 0
        m.slideIndex = preservedIndex
        renderActiveBanner()
        currentSlideSignature = FormatJson(m.slides[preservedIndex])
        if currentSlideSignature = previousSlideSignature
            ' A sincronização alterou outro item (por exemplo, uma captura
            ' ainda em andamento). Manter a tela e o cronômetro atuais evita
            ' voltar ao primeiro dashboard a cada revisão do estado.
            updateSlideStatus()
            return
        end if
        m.slideIndex = preservedIndex - 1
    else
        m.slideIndex = -1
    end if
    if m.slides.Count() = 0
        showEmptyState()
    else
        showNextSlide()
    end if
end sub

sub showNextSlide()
    if m.slides.Count() = 0 then return
    m.slideIndex = (m.slideIndex + 1) mod m.slides.Count()
    renderActiveBanner()
    renderSlide(m.slides[m.slideIndex])
end sub

sub showPreviousSlide()
    if m.slides.Count() = 0 then return
    m.slideIndex = m.slideIndex - 1
    if m.slideIndex < 0 then m.slideIndex = m.slides.Count() - 1
    renderActiveBanner()
    renderSlide(m.slides[m.slideIndex])
end sub

sub renderSlide(slide as object)
    cancelPendingImage()
    m.slideTimer.control = "stop"
    imageUrl = valueOr(slide, "imageUrl", "")

    if imageUrl <> ""
        queueImageSlide(slide, imageUrl)
        return
    else
        hideDashboardImages()
        m.messagePanel.visible = false
        m.pprPanel.visible = false

        if slide.kind = "alert"
            m.messagePanel.visible = true
            renderAlertSlide(slide)
        else if Left(slide.kind, 4) = "ppr-"
            m.pprPanel.visible = true
            renderPprSlide(slide)
        else
            m.messagePanel.visible = true
            renderDashboardPlaceholder(slide)
        end if
    end if

    m.contentGroup.opacity = 0.0
    m.fadeIn.control = "start"
    updateSlideStatus()

    startSlideTimer(slide)
end sub

sub queueImageSlide(slide as object, imageUrl as string)
    cancelPendingImage()
    m.pendingSlide = slide
    m.pendingImageUri = imageUrl
    if m.currentImageName = "A"
        m.pendingImageName = "B"
    else
        m.pendingImageName = "A"
    end if

    target = posterFor(m.pendingImageName)
    target.visible = true
    target.opacity = 0.0
    target.translation = [0.0, 0.0]
    target.scale = [1.0, 1.0]
    target.uri = ""
    target.uri = imageUrl
    m.imageLoadTimer.control = "start"
end sub

sub onImageALoadStatus()
    if m.pendingImageName <> "A" then return
    handlePendingImageStatus(m.dashboardImageA.loadStatus)
end sub

sub onImageBLoadStatus()
    if m.pendingImageName <> "B" then return
    handlePendingImageStatus(m.dashboardImageB.loadStatus)
end sub

sub handlePendingImageStatus(status as string)
    if status = "ready"
        beginImageTransition()
    else if status = "failed"
        failedSlide = m.pendingSlide
        failedTarget = posterFor(m.pendingImageName)
        failedTarget.visible = false
        failedTarget.uri = ""
        m.imageLoadTimer.control = "stop"
        m.pendingImageName = ""
        m.pendingImageUri = ""
        m.pendingSlide = invalid
        if m.currentImageName = ""
            renderDashboardPlaceholder(failedSlide)
            m.messagePanel.visible = true
        end if
        startSlideTimer(failedSlide)
    end if
end sub

sub onImageLoadTimer()
    if m.pendingImageName = "" or m.pendingSlide = invalid then return
    target = posterFor(m.pendingImageName)
    if target.loadStatus = "ready"
        beginImageTransition()
        return
    end if

    timedOutSlide = m.pendingSlide
    target.visible = false
    target.uri = ""
    m.pendingImageName = ""
    m.pendingImageUri = ""
    m.pendingSlide = invalid
    if m.currentImageName = ""
        renderDashboardPlaceholder(timedOutSlide)
        m.messagePanel.visible = true
    end if
    startSlideTimer(timedOutSlide)
end sub

sub beginImageTransition()
    if m.pendingImageName = "" or m.pendingSlide = invalid then return
    m.imageLoadTimer.control = "stop"

    target = posterFor(m.pendingImageName)
    m.messagePanel.visible = false
    m.pprPanel.visible = false
    effect = m.transitionEffect

    if m.currentImageName = "" or effect = "none"
        target.opacity = 1.0
        target.translation = [0.0, 0.0]
        target.scale = [1.0, 1.0]
        completeImageTransition()
        return
    end if

    startOpacity = 0.0
    startTranslation = [0.0, 0.0]
    startScale = [1.0, 1.0]

    if effect = "slide-left"
        startOpacity = 1.0
        startTranslation = [1920.0, 0.0]
    else if effect = "slide-right"
        startOpacity = 1.0
        startTranslation = [-1920.0, 0.0]
    else if effect = "slide-up"
        startOpacity = 1.0
        startTranslation = [0.0, 1080.0]
    else if effect = "slide-down"
        startOpacity = 1.0
        startTranslation = [0.0, -1080.0]
    else if effect = "zoom"
        startScale = [0.92, 0.92]
        startTranslation = [76.8, 43.2]
    else if effect = "zoom-out"
        startScale = [1.08, 1.08]
        startTranslation = [-76.8, -43.2]
    end if

    target.opacity = startOpacity
    target.translation = startTranslation
    target.scale = startScale
    targetId = "dashboardImage" + m.pendingImageName
    m.imageEnterOpacity.fieldToInterp = targetId + ".opacity"
    m.imageEnterOpacity.keyValue = [startOpacity, 1.0]
    m.imageEnterTranslation.fieldToInterp = targetId + ".translation"
    m.imageEnterTranslation.keyValue = [startTranslation, [0.0, 0.0]]
    m.imageEnterScale.fieldToInterp = targetId + ".scale"
    m.imageEnterScale.keyValue = [startScale, [1.0, 1.0]]
    m.imageEnter.duration = m.transitionDuration
    m.transitionTimer.duration = m.transitionDuration + 0.05
    m.imageEnter.control = "start"
    m.transitionTimer.control = "start"
end sub

sub onTransitionTimer()
    completeImageTransition()
end sub

sub completeImageTransition()
    if m.pendingImageName = "" then return

    m.imageEnter.control = "stop"
    m.transitionTimer.control = "stop"
    oldImageName = m.currentImageName
    newImage = posterFor(m.pendingImageName)
    newImage.visible = true
    newImage.opacity = 1.0
    newImage.translation = [0.0, 0.0]
    newImage.scale = [1.0, 1.0]

    if oldImageName <> "" and oldImageName <> m.pendingImageName
        oldImage = posterFor(oldImageName)
        oldImage.visible = false
        oldImage.opacity = 0.0
        oldImage.uri = ""
    end if

    completedSlide = m.pendingSlide
    m.currentImageName = m.pendingImageName
    m.pendingImageName = ""
    m.pendingImageUri = ""
    m.pendingSlide = invalid
    updateSlideStatus()
    startSlideTimer(completedSlide)
end sub

sub cancelPendingImage()
    if m.pendingImageName = "" then return
    m.imageLoadTimer.control = "stop"
    pendingTarget = posterFor(m.pendingImageName)
    pendingTarget.visible = false
    pendingTarget.opacity = 0.0
    pendingTarget.uri = ""
    m.pendingImageName = ""
    m.pendingImageUri = ""
    m.pendingSlide = invalid
end sub

sub hideDashboardImages()
    m.imageEnter.control = "stop"
    m.transitionTimer.control = "stop"
    m.imageLoadTimer.control = "stop"
    m.dashboardImageA.visible = false
    m.dashboardImageB.visible = false
    m.dashboardImageA.uri = ""
    m.dashboardImageB.uri = ""
    m.currentImageName = ""
    m.pendingImageName = ""
    m.pendingImageUri = ""
    m.pendingSlide = invalid
end sub

sub startSlideTimer(slide as dynamic)
    if slide = invalid then return
    duration = valueOr(slide, "duration", m.defaultDuration)
    if duration < 5 then duration = 5
    m.slideTimer.duration = duration
    if not m.paused then m.slideTimer.control = "start"
end sub

sub appendSlides(target as object, source as object)
    for each slide in source
        target.Push(slide)
    end for
end sub

function pprTargetsStation(ppr as dynamic, station as dynamic, areaId as string) as boolean
    if ppr = invalid or not valueOr(ppr, "enabled", false) then return false
    stationIds = arrayOrEmpty(valueOr(ppr, "stationIds", ["*"]))
    areaIds = arrayOrEmpty(valueOr(ppr, "areaIds", ["*"]))
    stationId = valueOr(station, "id", "")
    return targetListMatches(stationIds, stationId) and targetListMatches(areaIds, areaId)
end function

function targetListMatches(values as object, currentValue as string) as boolean
    if values.Count() = 0 then return true
    for each candidate in values
        if candidate = "*" or candidate = currentValue then return true
    end for
    return false
end function

function activePprIndicators(ppr as dynamic) as object
    result = []
    indicators = arrayOrEmpty(valueOr(ppr, "indicators", []))
    for each indicator in indicators
        value = pprNumericValue(valueOr(indicator, "result", invalid))
        if valueOr(indicator, "enabled", true) and value >= 0 and value <= 150
            result.Push(indicator)
        end if
    end for
    return result
end function

function buildPprSlides(ppr as dynamic) as object
    result = []
    indicators = activePprIndicators(ppr)
    duration = valueOr(ppr, "duration", 30)
    if valueOr(ppr, "showSummary", true)
        result.Push({ id: "ppr-summary", kind: "ppr-summary", source: ppr, duration: duration })
    end if
    if valueOr(ppr, "showIndicators", true) and indicators.Count() > 0
        if LCase(valueOr(ppr, "displayMode", "individual")) = "general"
            result.Push({ id: "ppr-general", kind: "ppr-general", source: ppr, duration: duration })
        else
            for each indicator in indicators
                indicatorId = valueOr(indicator, "id", valueOr(indicator, "name", "ppr-indicator"))
                result.Push({ id: "ppr-" + indicatorId, kind: "ppr-individual", source: ppr, indicator: indicator, duration: duration })
            end for
        end if
    end if
    if result.Count() = 0
        result.Push({ id: "ppr-summary", kind: "ppr-summary", source: ppr, duration: duration })
    end if
    return result
end function

function pprNumericValue(value as dynamic) as float
    valueType = Type(value)
    if valueType = "Integer" or valueType = "LongInteger" or valueType = "Float" or valueType = "Double"
        return value
    end if
    if valueType = "String" and value <> "" then return Val(value)
    return -1
end function

function pprPercent(value as dynamic) as string
    numeric = pprNumericValue(value)
    if numeric < 0 then return "Sem resultado"
    return numeric.ToStr() + "%"
end function

function pprRuleFor(ppr as dynamic, value as float) as object
    rules = arrayOrEmpty(valueOr(ppr, "rules", []))
    for each rule in rules
        if value >= pprNumericValue(valueOr(rule, "min", 0)) and value <= pprNumericValue(valueOr(rule, "max", 150))
            return rule
        end if
    end for
    if value < 75 then return { message: "Abaixo do esperado", color: "#F59E0B" }
    if value < 100 then return { message: "Próximo da meta", color: "#38BDF8" }
    if value < 125 then return { message: "Meta atingida", color: "#22C55E" }
    if value < 150 then return { message: "Acima da meta", color: "#14B8A6" }
    return { message: "Desempenho máximo", color: "#8B5CF6" }
end function

function rokuColor(value as dynamic) as string
    if value = invalid then return "0x38BDF8FF"
    color = UCase(value.ToStr())
    if Left(color, 1) = "#" and Len(color) = 7 then return "0x" + Mid(color, 2) + "FF"
    if Left(color, 2) = "0X" then return color
    return "0x38BDF8FF"
end function

sub resetPprLayout()
    m.pprSummaryGroup.visible = false
    m.pprGaugeCard.visible = true
    m.pprGaugeCard.translation = [82, 232]
    m.pprGaugeCard.width = 500
    m.pprContentCard.visible = true
    m.pprContentCard.translation = [612, 232]
    m.pprContentCard.width = 1216
    m.pprValueCaption.visible = true
    m.pprValue.visible = true
    m.pprGoalContext.visible = true
    m.pprName.visible = true
    m.pprDescription.visible = true
    m.pprProgressTrack.visible = true
    m.pprProgressFill.visible = true
    m.pprDetails.visible = true
    m.pprValueCaption.translation = [650, 278]
    m.pprValue.translation = [650, 320]
    m.pprValue.width = 1050
    m.pprGoalContext.translation = [650, 462]
    m.pprName.translation = [650, 522]
    m.pprName.width = 1080
    m.pprDescription.translation = [650, 612]
    m.pprDescription.width = 1080
    m.pprDescription.height = 90
    m.pprProgressTrack.translation = [650, 718]
    m.pprProgressTrack.width = 1020
    m.pprProgressFill.translation = [650, 718]
    m.pprStatusBackground.translation = [650, 756]
    m.pprStatusBackground.width = 1020
    m.pprStatus.translation = [684, 775]
    m.pprDetails.translation = [650, 865]
    m.pprDetails.width = 1080
    m.pprDetails.height = 90
    m.pprStatusBackground.visible = true
    m.pprStatus.visible = true
end sub

sub renderPprSlide(slide as object)
    ppr = valueOr(slide, "source", {})
    applyPprTheme(valueOr(ppr, "theme", "light"))
    m.pprPeriod.text = "PERÍODO " + valueOr(ppr, "referencePeriod", "")
    resetPprLayout()
    if slide.kind = "ppr-individual"
        renderPprIndividual(ppr, valueOr(slide, "indicator", {}))
    else if slide.kind = "ppr-general"
        renderPprGeneral(ppr)
    else
        renderPprSummary(ppr)
    end if
end sub

sub applyPprTheme(theme as string)
    if LCase(theme) = "dark"
        m.pprBackground.color = "0x071426FF"
        m.pprHeaderLine.color = "0x1E3A5FFF"
        m.pprPeriodBackground.color = "0x172554FF"
        m.pprGaugeCard.color = "0x0F1E33FF"
        m.pprContentCard.color = "0x0F1E33FF"
        m.pprKicker.color = "0x38BDF8FF"
        m.pprTitle.color = "0xF8FAFCFF"
        m.pprPeriod.color = "0xE0F2FEFF"
        m.pprThermometerTrack.color = "0x1E293BFF"
        m.pprBulbTrack.color = "0x1E293BFF"
        m.pprName.color = "0xF8FAFCFF"
        m.pprDescription.color = "0xCBD5E1FF"
        m.pprDetails.color = "0x94A3B8FF"
        m.pprProgressTrack.color = "0x334155FF"
        m.pprSummaryScoreCard.color = "0x0F1E33FF"
        m.pprSummaryTotalCard.color = "0x0F1E33FF"
        m.pprSummaryReachedCard.color = "0x0F1E33FF"
        m.pprSummaryAttentionCard.color = "0x0F1E33FF"
        m.pprSummaryListCard.color = "0x0F1E33FF"
        m.pprSummaryTotal.color = "0xF8FAFCFF"
        m.pprSummaryList.color = "0xCBD5E1FF"
        setPprScaleColor("0xCBD5E1FF", "0xF8FAFCFF")
    else
        m.pprBackground.color = "0xF8FAFCFF"
        m.pprHeaderLine.color = "0xDBEAFEFF"
        m.pprPeriodBackground.color = "0xDBEAFEFF"
        m.pprGaugeCard.color = "0xFFFFFFFF"
        m.pprContentCard.color = "0xFFFFFFFF"
        m.pprKicker.color = "0x2563EBFF"
        m.pprTitle.color = "0x0F172AFF"
        m.pprPeriod.color = "0x1E40AFFF"
        m.pprThermometerTrack.color = "0xFFFFFFFF"
        m.pprBulbTrack.color = "0xFFFFFFFF"
        m.pprName.color = "0x0F172AFF"
        m.pprDescription.color = "0x475569FF"
        m.pprDetails.color = "0x64748BFF"
        m.pprProgressTrack.color = "0xCBD5E1FF"
        m.pprSummaryScoreCard.color = "0xFFFFFFFF"
        m.pprSummaryTotalCard.color = "0xFFFFFFFF"
        m.pprSummaryReachedCard.color = "0xFFFFFFFF"
        m.pprSummaryAttentionCard.color = "0xFFFFFFFF"
        m.pprSummaryListCard.color = "0xFFFFFFFF"
        m.pprSummaryTotal.color = "0x0F172AFF"
        m.pprSummaryList.color = "0x334155FF"
        setPprScaleColor("0x475569FF", "0x0F172AFF")
    end if
end sub

sub setPprScaleColor(regular as string, meta as string)
    m.pprScale150.color = regular
    m.pprScale125.color = regular
    m.pprScale75.color = regular
    m.pprScale50.color = regular
    m.pprScale0.color = regular
    m.pprScale100.color = meta
end sub

sub renderPprIndividual(ppr as dynamic, indicator as dynamic)
    value = pprNumericValue(valueOr(indicator, "result", 0))
    rule = pprRuleFor(ppr, value)
    color = rokuColor(valueOr(rule, "color", "#22C55E"))
    fillHeight = Int((value / 150.0) * 608.0)
    if fillHeight < 0 then fillHeight = 0
    if fillHeight > 608 then fillHeight = 608
    m.pprThermometerGroup.visible = true
    m.pprThermometerFill.height = fillHeight
    m.pprThermometerFill.translation = [186, 868 - fillHeight]
    m.pprThermometerFill.color = color
    m.pprBulb.color = color
    updatePprScaleLabels(indicator)
    m.pprValueCaption.text = "DESEMPENHO ATUAL"
    m.pprValue.text = pprPercent(value)
    m.pprValue.color = color
    if value >= 100
        if value = 100
            m.pprGoalContext.text = "META ATINGIDA"
        else
            m.pprGoalContext.text = pprPercent(value - 100) + " ACIMA DA META"
        end if
    else
        m.pprGoalContext.text = "FALTAM " + pprPercent(100 - value) + " PARA A META"
    end if
    m.pprGoalContext.color = color
    m.pprName.text = valueOr(indicator, "name", "Indicador do PPR")
    m.pprDescription.text = valueOr(indicator, "description", "")
    m.pprStatusBackground.color = color
    m.pprStatus.text = valueOr(rule, "message", "Resultado atualizado")
    progressWidth = Int((value / 150.0) * 1020.0)
    if progressWidth < 0 then progressWidth = 0
    if progressWidth > 1020 then progressWidth = 1020
    m.pprProgressFill.width = progressWidth
    m.pprProgressFill.color = color
    details = pprOperationalText(indicator)
    if details <> "" then details = details + "  •  "
    details = details + "Referência: " + valueOr(indicator, "referenceDate", "Não informada")
    note = valueOr(indicator, "note", "")
    if note <> "" then details = details + "  •  " + note
    m.pprDetails.text = details
end sub

sub updatePprScaleLabels(indicator as dynamic)
    rows = [
        { node: m.pprScale150, percent: 150 },
        { node: m.pprScale125, percent: 125 },
        { node: m.pprScale100, percent: 100 },
        { node: m.pprScale75, percent: 75 },
        { node: m.pprScale50, percent: 50 },
        { node: m.pprScale0, percent: 0 }
    ]
    unit = valueOr(indicator, "unit", "")
    for each row in rows
        prefix = row.percent.ToStr() + "%"
        if row.percent = 100 then prefix = "100% META"
        expected = pprBandLabel(indicator, row.percent)
        if expected <> "" and unit <> "" and Instr(1, LCase(expected), LCase(unit)) = 0 then expected = expected + " " + unit
        if expected <> "" then prefix = prefix + "   " + expected
        row.node.text = prefix
    end for
end sub

function pprBandLabel(indicator as dynamic, percent as integer) as string
    bands = arrayOrEmpty(valueOr(indicator, "performanceBands", []))
    for each band in bands
        if pprNumericValue(valueOr(band, "percent", -1)) = percent
            return valueOr(band, "label", "")
        end if
    end for
    return ""
end function

sub renderPprSummary(ppr as dynamic)
    indicators = activePprIndicators(ppr)
    total = indicators.Count()
    reached = 0
    sum = 0.0
    lines = ""
    for each indicator in indicators
        value = pprNumericValue(valueOr(indicator, "result", 0))
        sum = sum + value
        if value >= 100 then reached = reached + 1
        if lines <> "" then lines = lines + Chr(10) + Chr(10)
        rule = pprRuleFor(ppr, value)
        lines = lines + pprPercent(value) + "   " + valueOr(indicator, "name", "Indicador") + "   •   " + valueOr(rule, "message", "Atualizado")
        operational = pprOperationalText(indicator)
        if operational <> "" then lines = lines + "   |   " + operational
    end for
    average = 0.0
    if total > 0 then average = sum / total
    m.pprThermometerGroup.visible = false
    m.pprGaugeCard.visible = false
    m.pprContentCard.visible = false
    m.pprValueCaption.visible = false
    m.pprValue.visible = false
    m.pprGoalContext.visible = false
    m.pprName.visible = false
    m.pprDescription.visible = false
    m.pprProgressTrack.visible = false
    m.pprProgressFill.visible = false
    m.pprStatusBackground.visible = false
    m.pprStatus.visible = false
    m.pprDetails.visible = false
    m.pprSummaryGroup.visible = true
    m.pprSummaryAverage.text = pprPercent(average)
    m.pprSummaryTotal.text = total.ToStr()
    m.pprSummaryReached.text = reached.ToStr()
    m.pprSummaryAttention.text = (total - reached).ToStr()
    if lines = "" then lines = "Nenhum indicador possui resultado atualizado."
    m.pprSummaryList.text = lines
end sub

sub renderPprGeneral(ppr as dynamic)
    indicators = activePprIndicators(ppr)
    lines = ""
    for each indicator in indicators
        value = pprNumericValue(valueOr(indicator, "result", 0))
        rule = pprRuleFor(ppr, value)
        if lines <> "" then lines = lines + Chr(10) + Chr(10)
        lines = lines + pprPercent(value) + "   " + valueOr(indicator, "name", "Indicador") + "   —   " + valueOr(rule, "message", "")
        operational = pprOperationalText(indicator)
        if operational <> "" then lines = lines + "   |   " + operational
    end for
    m.pprThermometerGroup.visible = false
    m.pprGaugeCard.visible = false
    m.pprContentCard.translation = [92, 240]
    m.pprContentCard.width = 1736
    m.pprValueCaption.translation = [130, 280]
    m.pprValueCaption.text = "VISÃO CONSOLIDADA"
    m.pprValue.translation = [130, 330]
    m.pprValue.width = 1600
    m.pprValue.text = "Painel geral de indicadores"
    m.pprValue.color = "0x38BDF8FF"
    m.pprGoalContext.visible = false
    m.pprName.translation = [130, 470]
    m.pprName.width = 1600
    m.pprName.text = "Resultados de 0% a 150%"
    m.pprDescription.translation = [130, 560]
    m.pprDescription.width = 1600
    m.pprDescription.height = 330
    m.pprDescription.text = lines
    m.pprProgressTrack.visible = false
    m.pprProgressFill.visible = false
    m.pprStatusBackground.visible = false
    m.pprStatus.visible = false
    m.pprDetails.translation = [130, 910]
    m.pprDetails.width = 1600
    m.pprDetails.text = "Meta destacada em 100%  •  Atualização manual pela Central Web"
end sub

function pprOperationalText(indicator as dynamic) as string
    unit = valueOr(indicator, "unit", "")
    actual = valueOr(indicator, "operationalValue", "")
    expected = pprBandLabel(indicator, pprNumericValue(valueOr(indicator, "result", 0)))
    result = ""
    if actual <> ""
        result = "Realizado " + actual
        if unit <> "" then result = result + " " + unit
    end if
    if expected <> ""
        if result <> "" then result = result + "   •   "
        result = result + "Faixa " + expected
        if unit <> "" and Instr(1, LCase(expected), LCase(unit)) = 0 then result = result + " " + unit
    end if
    return result
end function

function posterFor(name as string) as dynamic
    if name = "A" then return m.dashboardImageA
    return m.dashboardImageB
end function

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

sub renderActiveBanner()
    if m.bannerAlerts = invalid or m.bannerAlerts.Count() = 0
        renderBanner(invalid)
        return
    end if
    index = m.slideIndex
    if index < 0 then index = 0
    renderBanner(m.bannerAlerts[index mod m.bannerAlerts.Count()])
end sub

sub showLoading(message as string)
    m.loading.visible = true
    m.loading.control = "start"
    m.stationLabel.text = "Central Dashboards TVs"
    m.syncLabel.text = message
end sub

sub showError(message as string)
    hideDashboardImages()
    m.pprPanel.visible = false
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
    hideDashboardImages()
    m.pprPanel.visible = false
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

    if m.introPlaying
        if key = "OK" or key = "back"
            finishIntroVideo()
        end if
        return true
    end if

    if m.stationOverlay.visible
        if key = "back"
            if m.currentStation <> invalid
                hideStationSelector()
                return true
            end if
        end if
        return false
    end if

    if key = "options" or key = "OK" or key = "down"
        showStationSelector()
        return true
    else if key = "right"
        showNextSlide()
        return true
    else if key = "left"
        showPreviousSlide()
        return true
    else if key = "play"
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

function slideIdentity(slide as dynamic) as string
    if slide = invalid then return ""
    kind = valueOr(slide, "kind", "slide")
    id = valueOr(slide, "id", "")
    if id <> "" then return kind + ":" + id
    return kind + ":" + valueOr(slide, "title", "")
end function

function findSlideIndex(slides as object, previousSlide as dynamic) as integer
    identity = slideIdentity(previousSlide)
    if identity = "" then return -1
    if slides.Count() = 0 then return -1
    for index = 0 to slides.Count() - 1
        if slideIdentity(slides[index]) = identity then return index
    end for
    return -1
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

function findStationChoiceIndex(stationId as string) as integer
    if stationId = "" then return -1
    for index = 0 to m.stationChoices.Count() - 1
        if valueOr(m.stationChoices[index], "id", "") = stationId then return index
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
