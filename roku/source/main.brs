sub Main(args as dynamic)
    previousExit = "EXIT_UNKNOWN"
    if args <> invalid and args.DoesExist("lastExitOrTerminationReason")
        previousExit = args.lastExitOrTerminationReason
    end if
    print "[LIFECYCLE] app-launch previousExit="; previousExit

    screen = CreateObject("roSGScreen")
    messagePort = CreateObject("roMessagePort")
    screen.SetMessagePort(messagePort)

    scene = screen.CreateScene("MainScene")
    scene.previousExitReason = previousExit
    screen.Show()

    while true
        message = Wait(0, messagePort)
        if Type(message) = "roSGScreenEvent"
            if message.IsScreenClosed()
                print "[LIFECYCLE] screen-closed"
                return
            end if
        end if
    end while
end sub
