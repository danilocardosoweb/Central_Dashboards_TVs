sub Main()
    screen = CreateObject("roSGScreen")
    messagePort = CreateObject("roMessagePort")
    screen.SetMessagePort(messagePort)

    scene = screen.CreateScene("MainScene")
    screen.Show()

    while true
        message = Wait(0, messagePort)
        if Type(message) = "roSGScreenEvent"
            if message.IsScreenClosed()
                return
            end if
        end if
    end while
end sub
