# mc server tester

simple command line tool to check if minecraft server is working and get all informations without opening the game.
it show ping in ms, players count, exact game version, motd description and if server is online or cracked.
works fast and has no colorful terminal mess, just clean text.

## what it can do

1. test any minecraft java server from version 1.0 to 1.21+
2. test bedrock pocket edition servers too
3. show real ping in ms and dns lookup time
4. show online players count and max slots
5. clean motd text without color codes
6. check if server need premium account or allow cracked
7. auto resolve server names like hypixel or 2b2t so you dont have to type full domain
8. clean messy text if you copy paste from discord or browser

## how to install and run

you need nodejs installed on your pc. if you dont have it download nodejs from official site and install it.

step 1. download this repository or clone it using git:
git clone https://github.com/Kl3ban/mc-server-tester.git

step 2. open terminal inside the downloaded folder:
cd mc-server-tester

step 3. install it globally on your system:
npm install -g .

now you can use the command everywhere in your terminal.

## how to use it

you can run it with server ip directly:
test hypixel.net
test play.cubecraft.net
test 2b2t.org

you can also just write server name without domain:
test hypixel
test cubecraft
test the hive

you can also run it without arguments and it will ask you to enter server in terminal:
test

to exit interactive mode type q or exit.
