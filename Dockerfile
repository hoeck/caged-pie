FROM ubuntu:25.04

# Set non-interactive frontend to avoid prompts during build
ENV DEBIAN_FRONTEND=noninteractive

# install node and some common cli tools
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
    curl \
    patch \
    jq \
    wget \
    ripgrep \
    tree \
    less \
    binutils \
    nodejs \
    npm


# run the agent with limited perms
USER ubuntu

# install pi as a global command but keep it readable by itself
# also mount the npm path from an external path/volume so that its cached and
# writable by pi
ENV PATH="$PATH:/home/ubuntu/npm/bin"
RUN npm config set prefix /home/ubuntu/npm

# mount the current project here
RUN mkdir /home/ubuntu/project
WORKDIR /home/ubuntu/project

# Run as non-root by default
CMD ["pi"]
