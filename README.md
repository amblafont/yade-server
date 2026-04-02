This repo can be readily imported in some (node.js) hosting platform, such as render.com, to have a running server.
Then you can connect to the server (from the [diagram editor](https://amblafont.github.io/graph-editor/index.html)) by clicking the Connect button and entering wss://address-of-the-server. (Alternatively, one can add the GET parameter ?server=wss://address-of-the-server to the diagram editor webpage).

The server can manage multiple independent sessions (created on demand, see below): all the clients who connect to the same session shares the same whiteboard. The server deletes a session when the last user quits the session, so don't forget to save the whiteboard on your computer!

# Give it a try!

A [test server](https://amblafont.github.io/graph-editor/index.html?server=wss://yade-server-yade.apps.math.cnrs.fr/test) is available. Beware that anyone who connects to this (public) server will be able to edit the whiteboard.

# How to set up your own server for free

1. Create a free account on some free (nodejs) hosting platform such as render.com, replit.com. If you have an account in some French research institute (such as INRIA or CNRS) you can also use  [https://plmshift.math.cnrs.fr/](https://plmshift.math.cnrs.fr/).
2. Create a new (node.js) project by importing this github repository (in plmshift, after creating a project, click on + in the top toolbar, for Quick create).
3. Visit the homepage of your newly created website: there you will find a link to the diagram editor that will automatically connect to your server.

# Managing multiple independent sessions

The server creates independent sessions on demand (and deletes them when no user are connected). To connect to a particular session named 'foo', you just have to use the address 'wss://address-of-the-server/foo' instead of 'wss://address-of-the-server' as explained in the introduction.

