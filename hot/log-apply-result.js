/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
	renewedModules表示新创建的模块
*/
module.exports = function(updatedModules, renewedModules) {
	//更新的modules,不在renewedModules里面的更新的模块都是要全局reload的
	var unacceptedModules = updatedModules.filter(function(moduleId) {
		return renewedModules && renewedModules.indexOf(moduleId) < 0;
	});

	if(unacceptedModules.length > 0) {
		console.warn("[HMR] The following modules couldn't be hot updated: (They would need a full reload!)");
		unacceptedModules.forEach(function(moduleId) {
			console.warn("[HMR]  - " + moduleId);
		});
	}
     
	if(!renewedModules || renewedModules.length === 0) {
		console.log("[HMR] Nothing hot updated.");
	} else {
		console.log("[HMR] Updated modules:");
		//更新的模块
		renewedModules.forEach(function(moduleId) {
			console.log("[HMR]  - " + moduleId);
		});
		//每一个moduleId都是数字那么建议使用NamedModulesPlugin
		var numberIds = renewedModules.every(function(moduleId) {
			return typeof moduleId === "number";
		});
		if(numberIds)
			console.log("[HMR] Consider using the NamedModulesPlugin for module names.");
	}
};
