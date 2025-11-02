import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedFHERacePredict = await deploy("FHERacePredict", {
    from: deployer,
    log: true,
  });

  console.log(`FHERacePredict contract: `, deployedFHERacePredict.address);
};
export default func;
func.id = "deploy_FHERacePredict"; // id required to prevent reexecution
func.tags = ["FHERacePredict"];
