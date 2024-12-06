This repo can be readily imported in some (node.js) hosting platform, such as glitch.com, to have a running server.
Then you can connect to the server (from the [diagram editor](https://amblafont.github.io/graph-editor/index.html)) by clicking the Connect button and entering wss://address-of-the-server. (Alternatively, one can add the GET parameter ?server=wss://address-of-the-server to the diagram editor webpage).

Everyone who connects to a server shares the same whiteboard. The server resets when the last user quits the session, so don't forget to save the whiteboard on your machine!

# Give it a try!

A [test server](https://yade-server-test.glitch.me/) is available (you may have to wait a little bit before the server is ready, if it is not currently used). Beware that anyone who connects to this (public) server will be able to edit the whiteboard.

# How to set up your own server for free on glitch.com

1. Create a free account on glitch.com
2. Create a new project by importing this github repository
3. Visit the homepage of your newly created website: there you will find a link to the diagram editor that will automatically connect to your server.

Beware that you sometimes need to re-visit the homepage to wake up the server, if you haven't used it for some time. Indeed, glitch.com puts unused servers to sleep.
