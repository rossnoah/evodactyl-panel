{
  description = "Pterodactyl Panel";

  inputs = {
    flake-parts = {
      url = "github:hercules-ci/flake-parts";
      inputs.nixpkgs-lib.follows = "nixpkgs";
    };

    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    systems.url = "github:nix-systems/default";
  };

  outputs = {self, ...} @ inputs:
    inputs.flake-parts.lib.mkFlake {inherit inputs;} {
      systems = import inputs.systems;

      perSystem = {pkgs, ...}: {
        devShells.default = pkgs.mkShellNoCC {
          buildInputs = with pkgs; [
            bun
            mysql80
            redis
          ];

          shellHook = ''
            PATH="$PATH:${pkgs.docker-compose}/libexec/docker/cli-plugins"
          '';
        };
      };
    };
}
