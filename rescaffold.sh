#! /bin/bash

if [ "$1" != "-y" ]; then
    echo "This scruipt assume you wish to build a demo app at the following directory: ../new_app"
    echo
    echo "If this directory exists, it will be forcibly deleted."
    echo
    echo "Do you wish to contine and delete any existing files at this location?"
    echo

    read -p "Press ENTER to continue..."
fi

rm -rf ../new_app
./scaffold.sh ../new_app
