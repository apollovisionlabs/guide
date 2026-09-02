// Substitue par les bundlers. Declare ici pour ne pas faire entrer les types Node dans un
// paquet navigateur.
declare const process: { env: { NODE_ENV?: string } }
