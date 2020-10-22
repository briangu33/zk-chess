#!/bin/bash
echo "clearing files to rebuild"
rm circuit.r1cs
rm circuit.wasm
rm circuit.sym
rm circuit_init.zkey
rm circuit.zkey
rm verification_key.json
rm verifier.sol
rm proof.json
rm public.json
echo "compiling circuit to r1cs..." &&
date &&
circom circuit.circom --r1cs --wasm --sym &&
rm -rf ../../client/public/circuits/init/ &&
mkdir -p ../../client/public/circuits/init/ &&
cp circuit.wasm ../../client/public/circuits/init/ &&
snarkjs r1cs info circuit.r1cs &&
echo "generating prover and verification keys..." &&
date &&
snarkjs zkey new circuit.r1cs pot15_final.ptau circuit_init.zkey &&
snarkjs zkey contribute circuit_init.zkey circuit.zkey -e="$(date)" &&
snarkjs zkey export verificationkey circuit.zkey verification_key.json &&
mkdir -p ../../client/public &&
cp ./circuit.zkey ../../client/public/init.zkey &&
echo "calculating witness..." &&
date &&
snarkjs wtns calculate circuit.wasm input.json witness.wtns &&
echo "generating proof..." &&
date &&
snarkjs groth16 prove circuit.zkey witness.wtns proof.json public.json
echo "verifying proof..." &&
date &&
snarkjs groth16 verify verification_key.json public.json proof.json &&
echo "compiling smart contract..." &&
date &&
snarkjs zkey export solidityverifier circuit.zkey verifier.sol &&
echo "done!" &&
date
