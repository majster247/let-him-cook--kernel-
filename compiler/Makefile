GREEN        := $(shell tput -Txterm setaf 2)
RESET        := $(shell tput -Txterm sgr0)
PREFIX       := $(HOME)/opt/cross
TARGET       := x86_64-elf
PATH         := $(PREFIX)/bin:$(PATH)

all: compiler

install-deps:
	sudo apt-get install g++ binutils libc6-dev-i386 mtools -y
	sudo apt-get install grub2 xorriso -y
	sudo apt-get install build-essential bison flex libgmp3-dev libmpc-dev libmpfr-dev texinfo libisl-dev -y

compiler: install-deps
	@echo "Setting up environment variables..."
	mkdir -p compiler
	cd compiler && \
		wget -nc https://ftp.gnu.org/gnu/binutils/binutils-2.43.tar.gz && \
		wget -nc https://ftp.gnu.org/gnu/gcc/gcc-14.2.0/gcc-14.2.0.tar.gz && \
		tar -xf binutils-2.43.tar.gz && \
		tar -xf gcc-14.2.0.tar.gz

	# Build binutils
	@echo "Building binutils..."
	cd compiler && \
		mkdir -p build-binutils && cd build-binutils && \
		../binutils-2.43/configure --target=$(TARGET) --prefix=$(PREFIX) --with-sysroot --disable-nls --disable-werror && \
		make -j4 && make install -j4

	# Verify binutils installation
	@which $(TARGET)-as || echo "$(TARGET)-as is not in the PATH"

	# Build GCC
	@echo "Building GCC..."
	cd compiler && \
		mkdir -p build-gcc && cd build-gcc && \
		../gcc-14.2.0/configure --target=$(TARGET) --prefix=$(PREFIX) --disable-nls --enable-languages=c,c++ --without-headers && \
		make all-gcc -j4 && make all-target-libgcc -j4 && \
		make install-gcc -j4 && make install-target-libgcc -j4

	# Test GCC installation
	$(PREFIX)/bin/$(TARGET)-gcc --version

	# Add PATH to shell profiles
	@echo "Updating shell profiles with cross compiler path..."
	@grep -qxF 'export PATH="$(PREFIX)/bin:$$PATH"' ~/.zshrc || echo 'export PATH="$(PREFIX)/bin:$$PATH"' >> ~/.zshrc
	@grep -qxF 'export PATH="$(PREFIX)/bin:$$PATH"' ~/.bashrc || echo 'export PATH="$(PREFIX)/bin:$$PATH"' >> ~/.bashrc

	@echo "$(GREEN)Compiler installed correctly$(RESET)"

clean:
	rm -rf compiler

export-compiler:
	export PATH="$HOME/opt/cross/bin:$PATH"

.PHONY: install-deps compiler clean
