# Caged Pie

Because I still don't trust that shit but fooling around with it relaxes my
stressed brain.

![caged-pie!](caged-pie.png)

Simple Dockerfile to create a container that runs the
[pi-coding-agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent)
with only access to your projects current directory.

# My Setup

1. clone this repo `git clone https://github.com/hoeck/caged-pie.git`
2. adjust the `pi-build` script to contain your preferred packages
3. build the caged-pie image: `./pi-build` (ignore the "Failed to clone repository" error)
4. add this repo to you PATH or a symlink from your user bin dir to `pi`,
   e.g. `cd ~/bin; ln -s ~/caged-pie/pi pi`
5. make sure you have the `OPENROUTER_API_KEY` env var set
6. go to your project and type `pi` to get going
7. use different pi configs by (e.g. different subagent configs) by changing
   the config in the repo using different branches

# Cost Report

```
$> ./cost-report.js
```

Show openrouter session costs parsed from the pi logs
