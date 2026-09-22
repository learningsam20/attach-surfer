export const checkHardwareCapabilities = () => {
  const memory = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const minMemory = 8;
  const minCores = 4;
  const isCapable = memory >= minMemory && cores >= minCores;

  return {
    memory,
    cores,
    isCapable,
    warnings: !isCapable
      ? [`Your device has ${memory}GB RAM and ${cores} cores. For optimal AI performance, we recommend at least ${minMemory}GB RAM and ${minCores} cores.`]
      : []
  };
};
