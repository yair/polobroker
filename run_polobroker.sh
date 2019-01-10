for (( ; ; ))
do
	nodejs polobroker.js 2>&1 | tee log/runlog_`date -u +"%Y-%m-%dT%H:%M:%SZ"`
done
